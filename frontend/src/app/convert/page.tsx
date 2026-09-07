"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Download,
  Eye,
  FileStack,
  Globe,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import ProgressBar from "@/components/ProgressBar";
import { useUniversalConvert } from "@/hooks/useUniversalConvert";
import { API_ENDPOINTS } from "@/utils/api";
import {
  ALL_SOURCE_EXTENSIONS,
  PAGE_SIZE_OPTIONS,
  PDF_TARGETS,
  PageSizeId,
  SourceKind,
  TO_PDF_TARGET,
  TargetOption,
  TargetOptionKey,
  describeKind,
  detectSourceKind,
  getExtension,
  rasterizeSvg,
  usesLibreOffice,
} from "@/utils/convertFormats";

interface SelectedFile {
  id: string;
  file: File;
  kind: SourceKind;
}

// Di atas ambang ini konversi dijalankan sebagai job latar belakang secara default,
// karena request sinkron berisiko kena timeout proxy.
const BACKGROUND_SIZE_THRESHOLD = 15 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ConvertPage() {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [targetId, setTargetId] = useState<string>("pdf");
  const [dpi, setDpi] = useState(150);
  const [pages, setPages] = useState("");
  const [pdfaVersion, setPdfaVersion] = useState(2);
  const [extractImages, setExtractImages] = useState(false);
  const [fitToPage, setFitToPage] = useState(false);
  const [mergeImages, setMergeImages] = useState(false);
  const [pageSize, setPageSize] = useState<PageSizeId>("auto");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginMm, setMarginMm] = useState(0);
  const [archivePdf, setArchivePdf] = useState(false);
  const [forceBackground, setForceBackground] = useState(false);

  const [url, setUrl] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const uploadRef = useRef<FileUploadZoneRef>(null);
  const { convert, cancel, reset, isProcessing, progress, statusMessage, error, result } =
    useUniversalConvert();

  const sourceIsPdf = files.length > 0 && files.every((item) => item.kind === "pdf");
  const hasMixedSources =
    files.some((item) => item.kind === "pdf") && files.some((item) => item.kind !== "pdf");
  const hasImages = files.some((item) => item.kind === "image");
  const hasSpreadsheet = files.some((item) => item.kind === "spreadsheet");
  // PDF/A langsung hanya tersedia lewat jalur ekspor LibreOffice
  const hasOfficeDoc = files.some((item) => usesLibreOffice(item.file.name));
  const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
  const useBackground = forceBackground || totalSize > BACKGROUND_SIZE_THRESHOLD;

  const availableTargets: TargetOption[] = useMemo(
    () => (sourceIsPdf ? PDF_TARGETS : [TO_PDF_TARGET]),
    [sourceIsPdf]
  );

  const activeTarget = useMemo(
    () => availableTargets.find((item) => item.id === targetId) ?? availableTargets[0],
    [availableTargets, targetId]
  );

  const targetSupports = (option: TargetOptionKey) =>
    Boolean(activeTarget?.options?.includes(option));

  // Mengambil gambar tertanam tidak melalui proses render, jadi DPI tidak berlaku
  const isExtractingImages = targetSupports("extractImages") && extractImages;

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: SelectedFile[] = [];
    const rejected: string[] = [];

    Array.from(incoming).forEach((file) => {
      const kind = detectSourceKind(file.name);
      if (!kind) {
        rejected.push(file.name);
        return;
      }
      accepted.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, kind });
    });

    setValidationError(
      rejected.length ? `Format tidak didukung: ${rejected.join(", ")}` : null
    );

    if (!accepted.length) return;

    setFiles((previous) => {
      const next = [...previous, ...accepted];
      // Target ikut menyesuaikan jenis sumber yang baru
      const allPdf = next.every((item) => item.kind === "pdf");
      setTargetId(allPdf ? "docx" : "pdf");
      return next;
    });
    reset();
  };

  const removeFile = (id: string) => {
    setFiles((previous) => {
      const next = previous.filter((item) => item.id !== id);
      if (next.length === 0) {
        setTargetId("pdf");
      } else if (next.every((item) => item.kind === "pdf")) {
        setTargetId((current) => (PDF_TARGETS.some((t) => t.id === current) ? current : "docx"));
      } else {
        setTargetId("pdf");
      }
      return next;
    });
  };

  const clearAll = () => {
    setFiles([]);
    setTargetId("pdf");
    setValidationError(null);
    reset();
    uploadRef.current?.reset();
  };

  const handleConvert = async () => {
    if (!files.length || !activeTarget) return;

    if (hasMixedSources) {
      setValidationError(
        "Pisahkan konversi: PDF dan berkas non-PDF punya target yang berbeda."
      );
      return;
    }

    setValidationError(null);
    const formData = new FormData();

    try {
      for (const item of files) {
        // SVG dirasterisasi di browser karena backend hanya menerima bitmap
        if (getExtension(item.file.name) === ".svg") {
          formData.append("files", await rasterizeSvg(item.file));
        } else {
          formData.append("files", item.file);
        }
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Gagal memproses berkas SVG");
      return;
    }

    if (sourceIsPdf) {
      formData.append("target", activeTarget.id);
      if (targetSupports("dpi") && !isExtractingImages) formData.append("dpi", String(dpi));
      if (targetSupports("pages") && pages.trim()) formData.append("pages", pages.trim());
      if (targetSupports("pdfaVersion")) formData.append("pdfa_version", String(pdfaVersion));
      if (targetSupports("extractImages")) {
        formData.append("extract_images", String(extractImages));
      }

      await convert({
        endpoint: API_ENDPOINTS.convertFromPdf,
        formData,
        background: useBackground,
      });
      return;
    }

    if (hasSpreadsheet) formData.append("fit_to_page", String(fitToPage));
    if (hasOfficeDoc && archivePdf) formData.append("pdf_variant", "pdfa");

    if (hasImages) {
      formData.append("merge_images", String(mergeImages));
      formData.append("page_size", pageSize);
      if (pageSize !== "auto") formData.append("orientation", orientation);
      formData.append("margin_mm", String(marginMm));
    }

    await convert({
      endpoint: API_ENDPOINTS.convertToPdf,
      formData,
      background: useBackground,
    });
  };

  const handleUrlConvert = async () => {
    if (!url.trim()) {
      setValidationError("Masukkan URL terlebih dahulu");
      return;
    }

    setValidationError(null);
    const formData = new FormData();
    formData.append("url", url.trim());

    await convert({
      endpoint: API_ENDPOINTS.convertUrlToPdf,
      formData,
      background: forceBackground,
    });
  };

  const resultIsPdf = result?.fileName.toLowerCase().endsWith(".pdf") ?? false;

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-violet-100/50 dark:bg-violet-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>Satu Halaman untuk Semua Format</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Convert <span className="text-violet-600 dark:text-violet-400">Apa Saja</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Word, Excel, PowerPoint, gambar, HTML, Markdown, EPUB, hingga PDF ke Word,
            Excel, CSV, gambar, teks, HTML, dan PDF/A. Bisa banyak berkas sekaligus.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          {/* Pemilih sumber: berkas atau URL */}
          <div className="flex gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => { setMode("file"); reset(); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === "file"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-200/50 dark:shadow-violet-900/50"
                  : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <FileStack size={16} />
              Dari Berkas
            </button>
            <button
              onClick={() => { setMode("url"); reset(); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === "url"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-200/50 dark:shadow-violet-900/50"
                  : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <Globe size={16} />
              Dari URL
            </button>
          </div>

          {result ? (
            <div className="p-8 space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 dark:text-green-300">
                  Konversi selesai
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1 break-all">
                  {result.fileName}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {resultIsPdf && (
                  <button
                    onClick={() => setIsPreviewOpen(true)}
                    className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold transition-all flex items-center gap-2"
                  >
                    <Eye size={18} />
                    Pratinjau
                  </button>
                )}
                <a
                  href={result.url}
                  download={result.fileName}
                  className="flex-1 min-w-[200px] py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-200/50 dark:shadow-green-900/50"
                >
                  <Download size={20} />
                  Unduh Hasil
                </a>
                <button
                  onClick={clearAll}
                  className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 font-semibold transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Konversi Lagi
                </button>
              </div>
            </div>
          ) : mode === "url" ? (
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                  Alamat halaman web
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://contoh.com/artikel"
                  className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Halaman diambil dan dirender oleh server. Alamat jaringan internal ditolak.
                </p>
              </div>

              {validationError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                  <AlertCircle size={18} />
                  {validationError}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {isProcessing && (
                <div className="space-y-3">
                  <ProgressBar progress={progress} label={statusMessage.toUpperCase()} />
                  <button
                    onClick={cancel}
                    className="w-full py-3 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Batalkan
                  </button>
                </div>
              )}

              <button
                onClick={handleUrlConvert}
                disabled={isProcessing || !url.trim()}
                className="w-full py-5 bg-slate-900 dark:bg-violet-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                <span className="text-lg">Jadikan PDF</span>
              </button>
            </div>
          ) : (
            <div className="p-2">
              <FileUploadZone
                ref={uploadRef}
                isDragging={isDragging}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
                }}
                onFileChange={(event) => {
                  if (event.target.files?.length) addFiles(event.target.files);
                }}
                multiple
                accept={ALL_SOURCE_EXTENSIONS.join(",")}
                label="Tarik berkas apa pun ke sini"
                subLabel="Word, Excel, PowerPoint, gambar, HTML, Markdown, EPUB, atau PDF"
              />

              {files.length > 0 && (
                <div className="p-6 pt-0 space-y-6">
                  {/* Daftar berkas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {files.length} berkas · {formatSize(totalSize)}
                      </p>
                      <button
                        onClick={clearAll}
                        className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        Kosongkan
                      </button>
                    </div>

                    {files.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center gap-3 border border-slate-100 dark:border-slate-600"
                      >
                        <span className="px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-bold uppercase">
                          {describeKind(item.kind)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-slate-500">{formatSize(item.file.size)}</p>
                        </div>
                        {!isProcessing && (
                          <button
                            onClick={() => removeFile(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            aria-label={`Hapus ${item.file.name}`}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {hasMixedSources && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-3">
                      <AlertCircle size={18} />
                      PDF dan berkas lain tidak bisa dikonversi dalam satu batch.
                    </div>
                  )}

                  {/* Pemilihan target */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                      Konversi ke
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availableTargets.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setTargetId(option.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            activeTarget?.id === option.id
                              ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                              : "border-slate-200 dark:border-slate-600 hover:border-violet-300"
                          }`}
                        >
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {option.label}
                          </p>
                        </button>
                      ))}
                    </div>
                    {activeTarget && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {activeTarget.description}
                      </p>
                    )}
                  </div>

                  {/* Opsi khusus target */}
                  <div className="space-y-4">
                    {targetSupports("extractImages") && (
                      <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={extractImages}
                          onChange={(event) => setExtractImages(event.target.checked)}
                          className="w-4 h-4 mt-0.5 accent-violet-600"
                        />
                        <span>
                          Ambil gambar yang tertanam saja
                          <span className="block text-xs text-slate-400 dark:text-slate-500">
                            Keluarkan foto asli di dalam PDF tanpa teks dan latar
                            halaman, bukan merender seluruh halaman.
                          </span>
                        </span>
                      </label>
                    )}

                    {targetSupports("dpi") && !isExtractingImages && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Resolusi: {dpi} DPI
                        </label>
                        <input
                          type="range"
                          min={72}
                          max={600}
                          step={6}
                          value={dpi}
                          onChange={(event) => setDpi(Number(event.target.value))}
                          className="w-full accent-violet-600"
                        />
                      </div>
                    )}

                    {targetSupports("pages") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Rentang halaman (kosongkan untuk semua)
                        </label>
                        <input
                          type="text"
                          value={pages}
                          onChange={(event) => setPages(event.target.value)}
                          placeholder="contoh: 1-3,7"
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    )}

                    {targetSupports("pdfaVersion") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Versi PDF/A
                        </label>
                        <select
                          value={pdfaVersion}
                          onChange={(event) => setPdfaVersion(Number(event.target.value))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <option value={1}>PDF/A-1 (paling ketat)</option>
                          <option value={2}>PDF/A-2 (disarankan)</option>
                          <option value={3}>PDF/A-3 (boleh lampiran)</option>
                        </select>
                      </div>
                    )}

                    {!sourceIsPdf && hasSpreadsheet && (
                      <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={fitToPage}
                          onChange={(event) => setFitToPage(event.target.checked)}
                          className="w-4 h-4 accent-violet-600"
                        />
                        Muat seluruh kolom spreadsheet dalam satu halaman
                      </label>
                    )}

                    {!sourceIsPdf && hasOfficeDoc && (
                      <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={archivePdf}
                          onChange={(event) => setArchivePdf(event.target.checked)}
                          className="w-4 h-4 mt-0.5 accent-violet-600"
                        />
                        <span>
                          Simpan sebagai PDF/A (arsip)
                          <span className="block text-xs text-slate-400 dark:text-slate-500">
                            Font ikut ditanam agar dokumen tetap terbaca sama dalam
                            jangka panjang. Ukuran berkas jadi lebih besar.
                          </span>
                        </span>
                      </label>
                    )}

                    {!sourceIsPdf && hasImages && (
                      <>
                        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={mergeImages}
                            onChange={(event) => setMergeImages(event.target.checked)}
                            className="w-4 h-4 accent-violet-600"
                          />
                          Gabungkan semua gambar menjadi satu PDF
                        </label>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Ukuran halaman gambar
                          </label>
                          <select
                            value={pageSize}
                            onChange={(event) => setPageSize(event.target.value as PageSizeId)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {PAGE_SIZE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Orientasi dan margin tidak berarti bila halaman mengikuti ukuran gambar */}
                        {pageSize !== "auto" && (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Orientasi
                              </label>
                              <div className="flex gap-2">
                                {(["portrait", "landscape"] as const).map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setOrientation(value)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                                      orientation === value
                                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-300"
                                    }`}
                                  >
                                    {value === "portrait" ? "Tegak" : "Mendatar"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Margin: {marginMm} mm
                              </label>
                              <input
                                type="range"
                                min={0}
                                max={50}
                                step={1}
                                value={marginMm}
                                onChange={(event) => setMarginMm(Number(event.target.value))}
                                className="w-full accent-violet-600"
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={useBackground}
                        disabled={totalSize > BACKGROUND_SIZE_THRESHOLD}
                        onChange={(event) => setForceBackground(event.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-violet-600"
                      />
                      <span>
                        Proses di latar belakang
                        <span className="block text-xs text-slate-400 dark:text-slate-500">
                          {totalSize > BACKGROUND_SIZE_THRESHOLD
                            ? "Wajib aktif karena total berkas lebih dari 15 MB."
                            : "Hindari timeout untuk dokumen berat; progres dipantau lewat polling."}
                        </span>
                      </span>
                    </label>
                  </div>

                  {(validationError || error) && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                      <AlertCircle size={18} />
                      {validationError || error}
                    </div>
                  )}

                  {isProcessing && (
                    <div className="space-y-3">
                      <ProgressBar progress={progress} label={statusMessage.toUpperCase()} />
                      <button
                        onClick={cancel}
                        className="w-full py-3 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        Batalkan konversi
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleConvert}
                    disabled={isProcessing || hasMixedSources}
                    className="w-full py-5 bg-slate-900 dark:bg-violet-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Zap size={20} className="group-hover:scale-125 transition-transform" />
                    )}
                    <span className="text-lg">
                      Konversi ke {activeTarget?.label ?? "PDF"}
                    </span>
                    {!isProcessing && <ArrowRight size={18} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-violet-500 mb-4 group-hover:scale-110 transition-transform">
              <Layers size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Batch</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Konversi banyak berkas sekaligus, hasilnya diunduh sebagai satu ZIP.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-violet-500 mb-4 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Dua Arah</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Bukan cuma ke PDF: PDF juga bisa dibalik jadi Word, Excel, gambar, dan teks.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-violet-500 mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Aman</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Berkas dihapus otomatis dari server segera setelah hasil dikirim.
            </p>
          </div>
        </div>

        <Footer />
      </div>

      {result && resultIsPdf && (
        <PdfPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          pdfUrl={result.url}
          fileName={result.fileName}
        />
      )}
    </main>
  );
}
