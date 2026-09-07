/**
 * Metadata format untuk halaman konversi universal.
 *
 * Backend adalah sumber kebenaran (GET /api/v1/convert/formats), tapi label,
 * pengelompokan, dan opsi khusus tiap target ditentukan di sini supaya UI bisa
 * langsung merender tanpa menunggu jaringan.
 */

export type SourceKind = "pdf" | "document" | "spreadsheet" | "presentation" | "image" | "web" | "ebook";

export interface TargetOption {
  id: string;
  label: string;
  description: string;
  /** Ekstensi berkas hasil, dipakai untuk nama unduhan default */
  extension: string;
  /** Opsi tambahan yang relevan untuk target ini */
  options?: TargetOptionKey[];
}

export type TargetOptionKey =
  | "dpi"
  | "pages"
  | "pdfaVersion"
  /** Ambil objek gambar yang tertanam, bukan merender halaman */
  | "extractImages";

/** Ukuran halaman yang bisa dipilih saat gambar dijadikan PDF */
export const PAGE_SIZE_OPTIONS = [
  { id: "auto", label: "Ikut ukuran gambar" },
  { id: "a4", label: "A4" },
  { id: "a3", label: "A3" },
  { id: "a5", label: "A5" },
  { id: "letter", label: "Letter" },
] as const;

export type PageSizeId = (typeof PAGE_SIZE_OPTIONS)[number]["id"];

/** Ekstensi yang bisa dikonversi menjadi PDF, dikelompokkan agar mudah dijelaskan ke pengguna */
export const SOURCE_GROUPS: Record<Exclude<SourceKind, "pdf">, string[]> = {
  document: [".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".markdown"],
  spreadsheet: [".xls", ".xlsx", ".ods", ".csv"],
  presentation: [".ppt", ".pptx", ".odp"],
  image: [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".heic", ".heif", ".svg"],
  web: [".html", ".htm"],
  ebook: [".epub"],
};

/** Semua ekstensi yang diterima halaman konversi */
export const ALL_SOURCE_EXTENSIONS: string[] = [
  ".pdf",
  ...Object.values(SOURCE_GROUPS).flat(),
];

/** Target yang tersedia bila sumbernya PDF */
export const PDF_TARGETS: TargetOption[] = [
  {
    id: "docx",
    label: "Word (.docx)",
    description: "Dokumen yang bisa diedit, layout dipertahankan sebisa mungkin.",
    extension: "docx",
  },
  {
    id: "xlsx",
    label: "Excel (.xlsx)",
    description: "Tabel di dalam PDF diekstrak menjadi sheet terpisah.",
    extension: "xlsx",
  },
  {
    id: "csv",
    label: "CSV (tabel)",
    description:
      "Tiap tabel yang terdeteksi menjadi satu berkas CSV terpisah. Butuh PDF yang memang punya tabel.",
    extension: "csv",
    options: ["pages"],
  },
  {
    id: "pptx",
    label: "PowerPoint (.pptx)",
    description: "Tiap halaman menjadi satu slide.",
    extension: "pptx",
    options: ["dpi"],
  },
  {
    id: "jpg",
    label: "Gambar JPG",
    description: "Render tiap halaman menjadi JPG. Lebih dari satu halaman diunduh sebagai ZIP.",
    extension: "jpg",
    options: ["dpi", "pages", "extractImages"],
  },
  {
    id: "png",
    label: "Gambar PNG",
    description: "Render tiap halaman menjadi PNG tanpa kompresi lossy.",
    extension: "png",
    options: ["dpi", "pages", "extractImages"],
  },
  {
    id: "webp",
    label: "Gambar WebP",
    description: "Ukuran berkas paling kecil untuk kualitas yang sama, cocok untuk web.",
    extension: "webp",
    options: ["dpi", "pages", "extractImages"],
  },
  {
    id: "tiff",
    label: "Gambar TIFF",
    description: "Lossless dengan kompresi deflate, biasa dipakai untuk arsip dan cetak.",
    extension: "tiff",
    options: ["dpi", "pages", "extractImages"],
  },
  {
    id: "txt",
    label: "Teks (.txt)",
    description: "Ambil seluruh teks dokumen sebagai berkas polos.",
    extension: "txt",
    options: ["pages"],
  },
  {
    id: "md",
    label: "Markdown (.md)",
    description: "Teks dengan struktur heading per halaman.",
    extension: "md",
    options: ["pages"],
  },
  {
    id: "html",
    label: "HTML",
    description: "Satu berkas HTML dengan posisi teks dipertahankan, siap dibuka di browser.",
    extension: "html",
    options: ["pages"],
  },
  {
    id: "epub",
    label: "EPUB",
    description: "Format e-book berbasis teks mengalir untuk dibaca di ponsel.",
    extension: "epub",
  },
  {
    id: "pdfa",
    label: "PDF/A (arsip)",
    description: "Versi PDF yang memenuhi standar penyimpanan jangka panjang.",
    extension: "pdf",
    options: ["pdfaVersion"],
  },
];

/** Satu-satunya target untuk sumber non-PDF */
export const TO_PDF_TARGET: TargetOption = {
  id: "pdf",
  label: "PDF",
  description: "Konversi berkas menjadi PDF.",
  extension: "pdf",
};

export function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

export function detectSourceKind(fileName: string): SourceKind | null {
  const ext = getExtension(fileName);
  if (ext === ".pdf") return "pdf";

  for (const [kind, extensions] of Object.entries(SOURCE_GROUPS)) {
    if (extensions.includes(ext)) return kind as SourceKind;
  }

  return null;
}

/**
 * Ekstensi yang dikonversi lewat LibreOffice.
 *
 * Hanya jalur ini yang bisa mengekspor PDF/A secara langsung, jadi opsi arsip
 * pada konversi ke PDF hanya ditawarkan bila batch memuat berkas seperti ini.
 */
export const OFFICE_EXTENSIONS: string[] = [
  ".doc", ".docx", ".odt", ".rtf", ".txt",
  ".xls", ".xlsx", ".ods", ".csv",
  ".ppt", ".pptx", ".odp",
  ".html", ".htm",
];

export function usesLibreOffice(fileName: string): boolean {
  return OFFICE_EXTENSIONS.includes(getExtension(fileName));
}

const KIND_LABELS: Record<SourceKind, string> = {
  pdf: "PDF",
  document: "Dokumen",
  spreadsheet: "Spreadsheet",
  presentation: "Presentasi",
  image: "Gambar",
  web: "Halaman web",
  ebook: "E-book",
};

export function describeKind(kind: SourceKind): string {
  return KIND_LABELS[kind];
}

/**
 * Rasterisasi SVG di browser.
 *
 * img2pdf di backend hanya menerima gambar bitmap, jadi SVG diubah menjadi PNG
 * lebih dulu di sisi klien - tidak perlu dependensi rendering vektor di server.
 */
export async function rasterizeSvg(file: File, scale = 2): Promise<File> {
  const source = await file.text();
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Gagal membaca SVG: ${file.name}`));
      element.src = blobUrl;
    });

    // SVG tanpa width/height eksplisit melaporkan ukuran 0; pakai ukuran default A4-ish
    const width = Math.round((image.naturalWidth || 1024) * scale);
    const height = Math.round((image.naturalHeight || 768) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia di browser ini");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) throw new Error(`Gagal mengubah ${file.name} menjadi PNG`);

    const baseName = file.name.replace(/\.svg$/i, "");
    return new File([blob], `${baseName}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
