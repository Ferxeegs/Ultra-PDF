"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";

type OutputFormat = "png" | "jpeg" | "webp";

interface SourceImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface ConvertedImage {
  name: string;
  blob: Blob;
  url: string;
  originalSize: number;
}

const ACCEPTED = ".jpg,.jpeg,.png,.webp,.bmp,.gif,.svg";

const FORMAT_LABELS: Record<OutputFormat, string> = {
  png: "PNG (tanpa kompresi lossy)",
  jpeg: "JPG (ukuran paling kecil)",
  webp: "WEBP (modern, kecil & tajam)",
};

const EXTENSIONS: Record<OutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Halaman konversi gambar yang berjalan sepenuhnya di browser.
 *
 * Tidak ada berkas yang dikirim ke server: Canvas sudah cukup untuk mengubah
 * format, mengubah ukuran, dan mengatur kualitas.
 */
export default function ImageConverterPage() {
  const [images, setImages] = useState<SourceImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(0.9);
  const [maxWidth, setMaxWidth] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConvertedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadRef = useRef<FileUploadZoneRef>(null);

  const isLossy = format !== "png";
  const totalOriginal = results.reduce((sum, item) => sum + item.originalSize, 0);
  const totalConverted = results.reduce((sum, item) => sum + item.blob.size, 0);

  const addImages = (incoming: FileList | File[]) => {
    const accepted: SourceImage[] = [];
    const rejected: string[] = [];

    Array.from(incoming).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        rejected.push(file.name);
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    setError(rejected.length ? `Bukan berkas gambar: ${rejected.join(", ")}` : null);
    if (accepted.length) setImages((previous) => [...previous, ...accepted]);
  };

  const removeImage = (id: string) => {
    setImages((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((item) => item.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    results.forEach((item) => URL.revokeObjectURL(item.url));
    setImages([]);
    setResults([]);
    setError(null);
    setProgress(0);
    uploadRef.current?.reset();
  };

  const convertOne = async (source: SourceImage): Promise<ConvertedImage> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Gagal membaca ${source.file.name}`));
      element.src = source.previewUrl;
    });

    // SVG tanpa dimensi intrinsik melaporkan 0; pakai ukuran default yang wajar
    let width = image.naturalWidth || 1024;
    let height = image.naturalHeight || 768;

    const limit = Number(maxWidth);
    if (limit > 0 && width > limit) {
      height = Math.round((height * limit) / width);
      width = limit;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia di browser ini");

    // JPEG tidak punya alpha: beri latar putih supaya transparansi tidak jadi hitam
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, `image/${format}`, isLossy ? quality : undefined)
    );
    if (!blob) throw new Error(`Gagal mengonversi ${source.file.name}`);

    const baseName = source.file.name.replace(/\.[^.]+$/, "");
    return {
      name: `${baseName}.${EXTENSIONS[format]}`,
      blob,
      url: URL.createObjectURL(blob),
      originalSize: source.file.size,
    };
  };

  const handleConvert = async () => {
    if (!images.length) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    results.forEach((item) => URL.revokeObjectURL(item.url));
    setResults([]);

    const converted: ConvertedImage[] = [];

    try {
      for (let index = 0; index < images.length; index += 1) {
        converted.push(await convertOne(images[index]));
        setProgress(Math.round(((index + 1) / images.length) * 100));
      }
      setResults(converted);
    } catch (err) {
      converted.forEach((item) => URL.revokeObjectURL(item.url));
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat konversi");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = async () => {
    if (results.length === 1) {
      const link = document.createElement("a");
      link.href = results[0].url;
      link.download = results[0].name;
      link.click();
      return;
    }

    const zip = new JSZip();
    results.forEach((item) => zip.file(item.name, item.blob));

    const archive = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gambar-${EXTENSIONS[format]}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-teal-100/50 dark:bg-teal-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-600 dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>100% Diproses di Browser</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Konversi <span className="text-teal-600 dark:text-teal-400">Gambar</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Ubah PNG, JPG, WEBP, dan SVG ke format lain sekaligus atur ukuran serta
            kualitasnya. Berkas tidak pernah meninggalkan perangkat Anda.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-2">
            <FileUploadZone
              ref={uploadRef}
              isDragging={isDragging}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (event.dataTransfer.files.length) addImages(event.dataTransfer.files);
              }}
              onFileChange={(event) => {
                if (event.target.files?.length) addImages(event.target.files);
              }}
              multiple
              accept={ACCEPTED}
              label="Tarik gambar ke sini"
              subLabel="Mendukung JPG, PNG, WEBP, BMP, GIF, dan SVG"
            />

            {images.length > 0 && (
              <div className="p-6 pt-0 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {images.length} gambar dipilih
                  </p>
                  <button
                    onClick={clearAll}
                    className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    Kosongkan
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((item) => (
                    <div
                      key={item.id}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 aspect-square"
                    >
                      {/* Pratinjau lokal, bukan next/image karena sumbernya object URL */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(item.id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Hapus ${item.file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                    Format keluaran
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((option) => (
                      <button
                        key={option}
                        onClick={() => setFormat(option)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          format === option
                            ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30"
                            : "border-slate-200 dark:border-slate-600 hover:border-teal-300"
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">
                          {EXTENSIONS[option]}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                          {FORMAT_LABELS[option]}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {isLossy && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Kualitas: {Math.round(quality * 100)}%
                    </label>
                    <input
                      type="range"
                      min={0.3}
                      max={1}
                      step={0.05}
                      value={quality}
                      onChange={(event) => setQuality(Number(event.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Lebar maksimum dalam piksel (kosongkan untuk ukuran asli)
                  </label>
                  <input
                    type="number"
                    min={16}
                    value={maxWidth}
                    onChange={(event) => setMaxWidth(event.target.value)}
                    placeholder="contoh: 1920"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                {isProcessing && <ProgressBar progress={progress} label="MENGONVERSI" />}

                {results.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">
                        {results.length} gambar selesai dikonversi
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        {formatSize(totalOriginal)} → {formatSize(totalConverted)}
                        {totalConverted < totalOriginal &&
                          ` (hemat ${Math.round((1 - totalConverted / totalOriginal) * 100)}%)`}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={downloadAll}
                        className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-200/50 dark:shadow-green-900/50"
                      >
                        <Download size={20} />
                        {results.length > 1 ? "Unduh Semua (ZIP)" : "Unduh Gambar"}
                      </button>
                      <button
                        onClick={() => {
                          results.forEach((item) => URL.revokeObjectURL(item.url));
                          setResults([]);
                          setProgress(0);
                        }}
                        className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 font-semibold transition-all flex items-center gap-2"
                      >
                        <RotateCcw size={18} />
                        Ulangi
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="w-full py-5 bg-slate-900 dark:bg-teal-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Zap size={20} className="group-hover:scale-125 transition-transform" />
                    )}
                    <span className="text-lg">Konversi Sekarang</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-teal-500 mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Tanpa Unggah</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Semua konversi terjadi di perangkat Anda, tidak ada berkas yang dikirim.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-teal-500 mb-4 group-hover:scale-110 transition-transform">
              <ImageIcon size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Banyak Format</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              PNG, JPG, dan WEBP dua arah, termasuk mengubah SVG menjadi bitmap.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-teal-500 mb-4 group-hover:scale-110 transition-transform">
              <Download size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Unduh Sekaligus</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Konversi puluhan gambar sekali jalan dan unduh semuanya sebagai ZIP.
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
