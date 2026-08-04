"""
Mask refinement pipeline for remove-background.

Uses guided-filter-based edge-aware smoothing, aggressive background cleanup,
and proper color decontamination for production-quality cutouts.
"""

import numpy as np
from PIL import Image
from PIL.Image import Image as PILImage
from scipy.ndimage import (
    binary_closing,
    binary_dilation,
    binary_erosion,
    binary_fill_holes,
    gaussian_filter,
    label,
    maximum_filter,
    median_filter,
    minimum_filter,
    sobel,
    uniform_filter,
)


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------


def _estimate_background_color(rgb: np.ndarray) -> np.ndarray:
    """Sample border pixels to estimate dominant background color."""
    h, w = rgb.shape[:2]
    band = max(3, min(h, w) // 30)
    border = np.concatenate(
        [
            rgb[:band, :, :].reshape(-1, 3),
            rgb[-band:, :, :].reshape(-1, 3),
            rgb[:, :band, :].reshape(-1, 3),
            rgb[:, -band:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(border, axis=0)


def _color_distance(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    diff = rgb - bg.reshape(1, 1, 3)
    return np.linalg.norm(diff, axis=2)


def _guided_filter(guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
    """
    Fast guided filter (box-filter variant) for edge-aware smoothing.

    guide : H×W float64 guide image (e.g. grayscale of input photo)
    src   : H×W float64 source to filter (0-1 range)
    radius: window half-size
    eps   : regularization (higher = smoother, lower = more edge-faithful)
    """
    size = 2 * radius + 1
    mean_g = uniform_filter(guide, size)
    mean_s = uniform_filter(src, size)
    corr_gs = uniform_filter(guide * src, size)
    var_g = uniform_filter(guide * guide, size) - mean_g * mean_g

    a = (corr_gs - mean_g * mean_s) / (var_g + eps)
    b = mean_s - a * mean_g

    mean_a = uniform_filter(a, size)
    mean_b = uniform_filter(b, size)
    return mean_a * guide + mean_b


def _remove_small_components(mask_binary: np.ndarray, min_pixels: int = 64) -> np.ndarray:
    """Remove connected components smaller than min_pixels from a binary mask."""
    labeled, num_features = label(mask_binary)
    if num_features == 0:
        return mask_binary
    cleaned = mask_binary.copy()
    for i in range(1, num_features + 1):
        component = labeled == i
        if np.sum(component) < min_pixels:
            cleaned[component] = False
    return cleaned


# ---------------------------------------------------------------------------
#  Main mask refinement
# ---------------------------------------------------------------------------


def refine_segmentation_mask(mask: PILImage, image: PILImage) -> PILImage:
    """
    Edge-aware mask refinement with aggressive background cleanup.

    Strategy:
      1. Hard floor: kill all near-zero alpha (< threshold) to remove faint bg residue
      2. Suppress background-colored pixels in the soft transition zone
      3. Remove small isolated foreground islands (noise)
      4. Fill pinholes inside solid foreground
      5. Apply guided filter for edge-aware smoothing
      6. Final hard floor + ceiling for crisp output
    """
    mask_arr = np.array(mask, dtype=np.float64)
    rgb = np.array(image.convert("RGB"), dtype=np.float64)
    gray = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    bg = _estimate_background_color(rgb)
    color_dist = _color_distance(rgb, bg)
    max_dist = float(color_dist.max()) + 1e-8
    color_dist_norm = color_dist / max_dist

    # Compute edge magnitude (Sobel).
    gx = sobel(gray, axis=1)
    gy = sobel(gray, axis=0)
    edges = np.hypot(gx, gy)
    edges /= edges.max() + 1e-8

    result = mask_arr.copy()

    # ---- 1) Hard floor: eliminate faint background residue ----
    # Any pixel with alpha < 25 is almost certainly background that leaked
    # through the model. Zero it out aggressively.
    faint_bg = result < 25
    result[faint_bg] = 0.0

    # ---- 2) Suppress background-colored pixels in transition zone ----
    # Pixels that look like the background color but have moderate alpha
    # are the primary source of visible background remnants.
    bg_like = color_dist_norm < 0.15
    bg_transition = bg_like & (result > 0) & (result < 220)

    # Stronger suppression for pixels that are very close to bg color.
    bg_similarity = np.clip(1.0 - color_dist_norm / 0.15, 0.0, 1.0)

    # The closer the pixel color is to background, the more we attenuate.
    # For near-identical colors (similarity > 0.8), nearly eliminate them.
    result[bg_transition] *= (1.0 - 0.75 * bg_similarity[bg_transition])

    # Hard kill for low-alpha bg-colored pixels — these are definite background.
    definite_bg = bg_like & (result < 80) & (edges < 0.08)
    result[definite_bg] = 0.0

    # Also kill medium-alpha pixels that are very bg-like AND have no edge.
    strong_bg = (color_dist_norm < 0.08) & (result < 160) & (edges < 0.06)
    result[strong_bg] = 0.0

    # ---- 3) Remove small isolated foreground islands (noise) ----
    # After the above cleanup, small scattered alpha patches may remain.
    # Remove connected components < 64 pixels.
    fg_binary = result > 30
    fg_cleaned = _remove_small_components(fg_binary, min_pixels=64)
    # Zero out pixels that were in small islands.
    noise_pixels = fg_binary & ~fg_cleaned
    result[noise_pixels] = 0.0

    # ---- 4) Recover thin foreground detail that contrasts with bg ----
    # Only boost pixels that have BOTH strong color contrast AND edges.
    # This is conservative — won't accidentally recover bg pixels.
    detail_candidate = (color_dist_norm > 0.20) & (edges > 0.10)
    thin_fg = detail_candidate & (mask_arr >= 15) & (mask_arr < 120) & (result > 0)
    result[thin_fg] = np.maximum(result[thin_fg], 180.0)

    # ---- 5) Fill pinholes inside solid foreground ----
    fg_solid = result > 128
    closed = binary_closing(fg_solid, structure=np.ones((3, 3), dtype=bool), iterations=2)
    filled = binary_fill_holes(closed)
    gap_fill = filled & ~fg_solid & (color_dist_norm > 0.10)
    result[gap_fill] = np.maximum(result[gap_fill], 200.0)

    # ---- 6) Edge-aware smoothing via guided filter ----
    guide_norm = gray / 255.0
    result_norm = result / 255.0
    result_norm = _guided_filter(guide_norm, result_norm, radius=3, eps=5e-4)
    result = result_norm * 255.0

    # ---- 7) Final cleanup: hard floor and ceiling ----
    # After all processing, apply definitive thresholds:
    #   - alpha < 15 → 0 (kill faint remnants)
    #   - alpha > 245 → 255 (solidify foreground)
    result[result < 15] = 0.0
    result[result > 245] = 255.0

    # Light smooth on the final output.
    smoothed = gaussian_filter(result, sigma=0.4)
    result = 0.85 * result + 0.15 * smoothed

    # Re-apply floor after smoothing (smoothing can re-introduce faint values).
    result[result < 10] = 0.0

    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8), mode="L")


# ---------------------------------------------------------------------------
#  Decontamination
# ---------------------------------------------------------------------------


def decontaminate_rgba(rgba: PILImage, bg_color: np.ndarray | None = None) -> PILImage:
    """
    Remove background color spill on semi-transparent edge pixels.

    Uses proper un-premultiply to push edge pixel colors toward the
    foreground interior color, producing clean compositing over any backdrop.
    """
    arr = np.array(rgba.convert("RGBA"), dtype=np.float64)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3] / 255.0

    if bg_color is None:
        bg_color = _estimate_background_color(rgb)

    bg = bg_color.reshape(1, 1, 3)

    # Edge band for treatment.
    edge = (alpha > 0.02) & (alpha < 0.95)

    if not np.any(edge):
        return rgba

    a_safe = np.maximum(alpha, 1e-4)[:, :, np.newaxis]

    # Un-premultiply: recover the true foreground color.
    fg_color = (rgb - (1.0 - alpha[:, :, np.newaxis]) * bg) / a_safe
    fg_color = np.clip(fg_color, 0, 255)

    # Sample interior foreground color to pull edge pixels toward.
    interior_mask = alpha > 0.90
    if np.any(interior_mask):
        dist_to_bg = np.linalg.norm(rgb - bg, axis=2)
        interior_strong = interior_mask & (dist_to_bg > 30)
        if np.any(interior_strong):
            interior_color = np.median(rgb[interior_strong], axis=0).reshape(1, 1, 3)
        else:
            interior_color = np.median(rgb[interior_mask], axis=0).reshape(1, 1, 3)
    else:
        interior_color = fg_color.copy()

    # Blend recovered fg toward interior average → removes color fringing.
    alpha_edge = alpha[edge, np.newaxis]
    blend_weight = np.clip((0.95 - alpha_edge) / 0.93, 0.0, 1.0) * 0.65
    decontaminated_fg = (
        fg_color[edge] * (1.0 - blend_weight)
        + interior_color.reshape(1, 3) * blend_weight
    )

    out_rgb = rgb.copy()
    out_rgb[edge] = np.clip(decontaminated_fg, 0, 255)

    out = np.dstack([out_rgb, arr[:, :, 3]])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), mode="RGBA")


# ---------------------------------------------------------------------------
#  Halo suppression
# ---------------------------------------------------------------------------


def suppress_background_halo(mask: PILImage, image: PILImage) -> PILImage:
    """
    Aggressively shrink alpha where pixels are background-colored,
    while protecting real object edges.
    """
    mask_arr = np.array(mask, dtype=np.float64)
    rgb = np.array(image.convert("RGB"), dtype=np.float64)
    gray = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    bg = _estimate_background_color(rgb)
    color_dist = _color_distance(rgb, bg)
    color_dist_norm = color_dist / (color_dist.max() + 1e-8)

    # Edge magnitude — protect real object boundaries.
    gx = sobel(gray, axis=1)
    gy = sobel(gray, axis=0)
    edge_mag = np.hypot(gx, gy)
    edge_mag /= edge_mag.max() + 1e-8

    # Detect halo: bg-colored pixels near foreground with non-trivial alpha.
    local_mask_max = maximum_filter(mask_arr, size=3)
    halo = (
        (color_dist_norm < 0.13)    # pixel is bg-like
        & (local_mask_max > 50)     # near some foreground
        & (mask_arr > 10)           # has non-trivial alpha
        & (mask_arr < 220)          # not solid foreground
        & (edge_mag < 0.12)         # NOT on a real edge
    )

    # Aggressive suppression with smooth falloff.
    suppression = np.clip(color_dist_norm[halo] / 0.13, 0.03, 1.0)
    mask_arr[halo] *= suppression

    # Second pass: kill any remaining very-faint halo.
    faint_halo = (mask_arr > 0) & (mask_arr < 20) & (color_dist_norm < 0.15)
    mask_arr[faint_halo] = 0.0

    return Image.fromarray(np.clip(mask_arr, 0, 255).astype(np.uint8), mode="L")
