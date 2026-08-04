import asyncio
import io
import logging
import os
from functools import lru_cache

from PIL import Image, ImageFilter
from rembg import new_session
from rembg.bg import fix_image_orientation

from app.services.mask_refinement import (
    decontaminate_rgba,
    refine_segmentation_mask,
    suppress_background_halo,
)
from app.services.rembg_bootstrap import register_bria_rmbg_14

register_bria_rmbg_14()

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "bria-rmbg-1.4"


def _execution_providers() -> list[str]:
    """
    Default: CPU only — avoids native crashes / ERR_EMPTY_RESPONSE when CUDA
    is missing or mismatched (onnxruntime-gpu without matching driver/cuDNN).

    Set REMBG_USE_CUDA=1 to prefer CUDA (requires onnxruntime-gpu + working GPU stack).
    """
    if os.getenv("REMBG_USE_CUDA", "").strip().lower() in ("1", "true", "yes", "on"):
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def _u2net_home() -> str:
    return os.getenv("U2NET_HOME", "/app/.u2net")


def _model_filename(model_name: str) -> str:
    return f"{model_name}.onnx"


def _is_local_model_available(model_name: str) -> bool:
    return os.path.exists(os.path.join(_u2net_home(), _model_filename(model_name)))


def _env_flag(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


@lru_cache(maxsize=4)
def _get_session(model_name: str):
    """
    Create singleton rembg session by model.
    GPU only when REMBG_USE_CUDA=1 and onnxruntime-gpu is installed.
    """
    providers = _execution_providers()

    logger.info(
        "Initializing rembg session with model=%s providers=%s",
        model_name,
        providers,
    )
    return new_session(model_name=model_name, providers=providers)


def _soft_alpha_cutout(img: Image.Image, mask: Image.Image) -> Image.Image:
    """
    Apply soft alpha mask with edge anti-aliasing.

    1. Use the mask directly as alpha channel (preserving soft edges)
    2. Apply a subtle smooth on the alpha to anti-alias staircase artifacts
       while preserving the overall mask shape
    """
    rgba = img.convert("RGBA")

    # Light anti-alias pass on the mask — only affects transition pixels
    # (near-0 and near-255 are unchanged, middle values get smoothed).
    mask_arr = mask.copy()

    # Apply a very gentle box blur only on edge transition pixels.
    # This removes 1px staircase artifacts without softening the mask globally.
    smoothed = mask_arr.filter(ImageFilter.SMOOTH)

    import numpy as np

    m_orig = np.array(mask_arr, dtype=np.float64)
    m_smooth = np.array(smoothed, dtype=np.float64)

    # Blend: use smoothed version only where mask is in transition zone (20-235).
    # Solid foreground/background keeps original values.
    transition = (m_orig > 15) & (m_orig < 240)
    m_out = m_orig.copy()
    blend_factor = 0.4  # subtle smoothing
    m_out[transition] = (
        m_orig[transition] * (1 - blend_factor) + m_smooth[transition] * blend_factor
    )

    final_mask = Image.fromarray(np.clip(m_out, 0, 255).astype(np.uint8), mode="L")
    rgba.putalpha(final_mask)
    return rgba


def _remove_background_sync(image_data: bytes, session) -> bytes:
    mask_refine = _env_flag("REMBG_MASK_REFINE", "1")
    decontaminate = _env_flag("REMBG_DECONTAMINATE", "1")
    halo_suppress = _env_flag("REMBG_HALO_SUPPRESS", "1")

    img = fix_image_orientation(Image.open(io.BytesIO(image_data)))
    mask = session.predict(img)[0]

    if mask_refine:
        mask = refine_segmentation_mask(mask, img)

    if halo_suppress:
        mask = suppress_background_halo(mask, img)

    cutout = _soft_alpha_cutout(img, mask)

    if decontaminate:
        cutout = decontaminate_rgba(cutout)

    # --- Final alpha cleanup (last line of defense) ---
    # Zero out any remaining faint alpha that survived the entire pipeline.
    # Solidify near-opaque pixels to 255.
    import numpy as np

    arr = np.array(cutout, dtype=np.uint8)
    alpha = arr[:, :, 3].astype(np.float64)
    alpha[alpha < 12] = 0       # kill faint remnants
    alpha[alpha > 248] = 255    # solidify foreground
    arr[:, :, 3] = alpha.astype(np.uint8)
    cutout = Image.fromarray(arr, mode="RGBA")

    buffer = io.BytesIO()
    cutout.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


class ImageService:
    @staticmethod
    async def remove_background(image_bytes: bytes) -> bytes:
        if not image_bytes:
            raise ValueError("Empty image bytes")

        def _process() -> bytes:
            preferred_model = os.getenv("REMBG_MODEL_NAME", DEFAULT_MODEL)
            max_side = int(os.getenv("REMBG_MAX_SIDE", "2560"))
            image_data = image_bytes

            with Image.open(io.BytesIO(image_bytes)) as img:
                width, height = img.size
                longest_side = max(width, height)
                if longest_side > max_side:
                    ratio = max_side / float(longest_side)
                    new_size = (max(1, int(width * ratio)), max(1, int(height * ratio)))
                    resized = img.resize(new_size, Image.LANCZOS)
                    buffer = io.BytesIO()
                    resized.save(buffer, format="PNG")
                    image_data = buffer.getvalue()

            if _is_local_model_available(preferred_model):
                session = _get_session(preferred_model)
            else:
                logger.warning(
                    "No local rembg model found in '%s'. Trying online fetch for model '%s'.",
                    _u2net_home(),
                    preferred_model,
                )
                try:
                    session = _get_session(preferred_model)
                except Exception as exc:
                    raise RuntimeError(
                        "No local rembg model found and online model download failed. "
                        f"Place {preferred_model}.onnx in '{_u2net_home()}', "
                        "or ensure container DNS/internet works."
                    ) from exc

            return _remove_background_sync(image_data, session)

        return await asyncio.to_thread(_process)
