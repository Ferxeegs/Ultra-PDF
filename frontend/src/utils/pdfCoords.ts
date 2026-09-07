/**
 * Konversi koordinat antara "view space" (yang dilihat user di editor) dan
 * "user space" PDF (yang dipakai pdf-lib saat menggambar).
 *
 * View space = sistem koordinat viewport pdf.js pada scale 1:
 *   - origin di KIRI-ATAS, sumbu Y ke BAWAH, satuan PDF points
 *   - sudah memperhitungkan /Rotate halaman dan CropBox
 *
 * User space = sistem koordinat asli PDF:
 *   - origin di KIRI-BAWAH MediaBox, sumbu Y ke ATAS
 *   - TIDAK memperhitungkan /Rotate
 *
 * Dua hal ini sering berbeda, dan itulah penyebab tanda tangan "pindah sendiri"
 * pada PDF hasil scan (halaman ber-/Rotate) atau PDF dengan CropBox != MediaBox.
 */

export interface PageLayout {
  /** origin CropBox di user space */
  boxX: number;
  boxY: number;
  /** ukuran CropBox di user space (belum dirotasi) */
  boxWidth: number;
  boxHeight: number;
  /** rotasi halaman ternormalisasi: 0 | 90 | 180 | 270 */
  rotation: number;
  /** ukuran halaman seperti yang terlihat user (sudah dirotasi) */
  viewWidth: number;
  viewHeight: number;
}

interface PdfLibPageLike {
  getRotation(): { angle: number };
  getCropBox(): { x: number; y: number; width: number; height: number };
  getMediaBox(): { x: number; y: number; width: number; height: number };
}

/** Normalisasi sudut ke salah satu dari 0/90/180/270. */
function normalizeQuarterTurn(angle: number): number {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized;
}

/**
 * Ambil layout halaman dari pdf-lib dengan semantik yang sama seperti
 * `page.getViewport({ scale: 1 })` milik pdf.js.
 */
export function getPageLayout(page: PdfLibPageLike): PageLayout {
  const media = page.getMediaBox();
  let box = media;
  try {
    const crop = page.getCropBox();
    // pdf.js memakai irisan CropBox dengan MediaBox; CropBox yang tidak valid diabaikan.
    if (crop && crop.width > 0 && crop.height > 0) {
      const x0 = Math.max(crop.x, media.x);
      const y0 = Math.max(crop.y, media.y);
      const x1 = Math.min(crop.x + crop.width, media.x + media.width);
      const y1 = Math.min(crop.y + crop.height, media.y + media.height);
      if (x1 > x0 && y1 > y0) {
        box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      }
    }
  } catch {
    // Tanpa CropBox, MediaBox sudah benar.
  }

  const rotation = normalizeQuarterTurn(page.getRotation().angle);
  const swapped = rotation === 90 || rotation === 270;

  return {
    boxX: box.x,
    boxY: box.y,
    boxWidth: box.width,
    boxHeight: box.height,
    rotation,
    viewWidth: swapped ? box.height : box.width,
    viewHeight: swapped ? box.width : box.height,
  };
}

/** Petakan satu titik view space (kiri-atas, Y ke bawah) ke user space PDF. */
export function viewPointToUserSpace(
  vx: number,
  vy: number,
  layout: PageLayout
): { x: number; y: number } {
  const { boxX, boxY, boxWidth, boxHeight, rotation } = layout;

  switch (rotation) {
    case 90:
      return { x: boxX + vy, y: boxY + vx };
    case 180:
      return { x: boxX + boxWidth - vx, y: boxY + vy };
    case 270:
      return { x: boxX + boxWidth - vy, y: boxY + boxHeight - vx };
    case 0:
    default:
      return { x: boxX + vx, y: boxY + boxHeight - vy };
  }
}

export interface ViewRect {
  /** kiri-atas kotak di view space, sebelum rotasi elemen */
  x: number;
  y: number;
  width: number;
  height: number;
  /** rotasi elemen dalam derajat SEARAH jarum jam (sama seperti CSS `rotate()`) */
  rotation?: number;
  /** titik putar elemen, harus cocok dengan `transform-origin` di editor */
  origin?: "center" | "top-left";
  /** titik putar eksplisit di view space; menimpa `origin` bila diisi */
  pivot?: { x: number; y: number };
}

export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** derajat berlawanan jarum jam, siap dipakai `degrees()` pdf-lib */
  rotate: number;
}

/**
 * Ubah kotak view space menjadi argumen `page.drawImage` pdf-lib.
 *
 * pdf-lib menggambar dengan urutan translate(x, y) -> rotate -> scale(w, h),
 * jadi (x, y) adalah sudut kiri-bawah gambar SETELAH rotasi, dan rotasinya
 * berlawanan arah jarum jam terhadap titik itu.
 */
export function viewRectToDrawRect(rect: ViewRect, layout: PageLayout): DrawRect {
  const { x, y, width, height } = rect;
  const cssRotation = rect.rotation || 0;
  const rad = (cssRotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Titik putar, harus sama dengan transform-origin di editor.
  const pivot =
    rect.pivot ||
    ((rect.origin || "center") === "center"
      ? { x: x + width / 2, y: y + height / 2 }
      : { x, y });

  // Sudut kiri-bawah kotak (sebelum rotasi), diputar mengelilingi pivot.
  // View space sumbu Y ke bawah, jadi matriks ini = rotasi searah jarum jam.
  const dx = x - pivot.x;
  const dy = y + height - pivot.y;
  const anchorVx = pivot.x + dx * cos - dy * sin;
  const anchorVy = pivot.y + dx * sin + dy * cos;

  const anchor = viewPointToUserSpace(anchorVx, anchorVy, layout);

  // Rotasi CSS searah jarum jam; rotasi halaman menambah offset berlawanan arah.
  const rotate = ((layout.rotation - cssRotation) % 360 + 360) % 360;

  return { x: anchor.x, y: anchor.y, width, height, rotate };
}

/**
 * Skala ulang koordinat yang disimpan bila ukuran halaman saat menyimpan
 * berbeda dengan ukuran halaman sebenarnya (mis. file diganti setelah
 * penempatan). Mencegah pergeseran diam-diam.
 */
export function rescaleToLayout<T extends { x: number; y: number; width: number; height: number }>(
  rect: T,
  storedPageWidth: number,
  storedPageHeight: number,
  layout: PageLayout
): T {
  if (
    !storedPageWidth ||
    !storedPageHeight ||
    (Math.abs(storedPageWidth - layout.viewWidth) < 0.5 &&
      Math.abs(storedPageHeight - layout.viewHeight) < 0.5)
  ) {
    return rect;
  }

  const sx = layout.viewWidth / storedPageWidth;
  const sy = layout.viewHeight / storedPageHeight;

  return {
    ...rect,
    x: rect.x * sx,
    y: rect.y * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  };
}
