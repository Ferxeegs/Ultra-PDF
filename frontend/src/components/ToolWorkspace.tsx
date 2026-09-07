"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import { useUniversalConvert } from "@/hooks/useUniversalConvert";

/**
 * Kerangka halaman satu alat: unggah berkas, atur opsi, kirim ke backend,
 * lalu tawarkan hasilnya untuk diunduh.
 *
 * Dipakai oleh alat konversi berkas tunggal maupun alat proteksi PDF supaya
 * penanganan batch, progres, pembatalan, dan pesan galat tidak ditulis ulang
 * di setiap halaman.
 */

export type AccentName = "amber" | "emerald" | "blue" | "sky" | "indigo" | "violet";

/**
 * Kelas Tailwind ditulis lengkap per aksen karena Tailwind memindai sumber
 * secara statis - nama kelas yang dirangkai saat runtime tidak akan dibuat.
 */
const ACCENTS: Record<
  AccentName,
  { text: string; badge: string; softBg: string; iconText: string; button: string; blob: string }
> = {
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    softBg: "bg-amber-100 dark:bg-amber-900/30",
    iconText: "text-amber-600 dark:text-amber-400",
    button: "bg-slate-900 dark:bg-amber-600",
    blob: "bg-amber-100/50 dark:bg-amber-900/10",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    badge:
      "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
    softBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconText: "text-emerald-600 dark:text-emerald-400",
    button: "bg-slate-900 dark:bg-emerald-600",
    blob: "bg-emerald-100/50 dark:bg-emerald-900/10",
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    badge:
      "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400",
    softBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "text-blue-600 dark:text-blue-400",
    button: "bg-slate-900 dark:bg-blue-600",
    blob: "bg-blue-100/50 dark:bg-blue-900/10",
  },
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    badge:
      "bg-sky-50 dark:bg-sky-900/30 border-sky-100 dark:border-sky-800 text-sky-600 dark:text-sky-400",
    softBg: "bg-sky-100 dark:bg-sky-900/30",
    iconText: "text-sky-600 dark:text-sky-400",
    button: "bg-slate-900 dark:bg-sky-600",
    blob: "bg-sky-100/50 dark:bg-sky-900/10",
  },
  indigo: {
    text: "text-indigo-600 dark:text-indigo-400",
    badge:
      "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400",
    softBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconText: "text-indigo-600 dark:text-indigo-400",
    button: "bg-slate-900 dark:bg-indigo-600",
    blob: "bg-indigo-100/50 dark:bg-indigo-900/10",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    badge:
      "bg-violet-50 dark:bg-violet-900/30 border-violet-100 dark:border-violet-800 text-violet-600 dark:text-violet-400",
    softBg: "bg-violet-100 dark:bg-violet-900/30",
    iconText: "text-violet-600 dark:text-violet-400",
    button: "bg-slate-900 dark:bg-violet-600",
    blob: "bg-violet-100/50 dark:bg-violet-900/10",
  },
};

export interface ToolFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface ToolWorkspaceProps {
  /** Bagian judul sebelum kata beraksen, misal "PDF ke " */
  title: string;
  /** Kata beraksen di akhir judul, misal "JPG" */
  titleAccent: string;
  description: string;
  accent: AccentName;
  /** Daftar ekstensi untuk input berkas, misal ".pdf" atau ".jpg,.jpeg,.png" */
  accept: string;
  multiple?: boolean;
  uploadLabel: string;
  uploadSubLabel: string;
  actionLabel: string;
  /** URL endpoint backend tujuan unggahan */
  endpoint: string;
  /** Jalankan sebagai job async; wajib untuk proses berat seperti PDF ke Word */
  background?: boolean;
  /**
   * Isi FormData dari berkas yang dipilih. Lempar Error untuk menolak
   * kiriman dengan pesan yang tampil di kartu galat.
   */
  buildFormData: (files: File[]) => FormData;
  /** Opsi tambahan yang dirender di antara daftar berkas dan tombol aksi */
  options?: ReactNode;
  /** Ditampilkan sebagai catatan kecil di atas tombol aksi */
  note?: string;
  features?: ToolFeature[];
}

const DEFAULT_FEATURES: ToolFeature[] = [
  {
    icon: Lock,
    title: "Privasi Tanpa Batas",
    desc: "Berkas Anda diproses lalu dihapus dari server, tidak pernah disimpan permanen.",
  },
  {
    icon: Zap,
    title: "Proses Cepat",
    desc: "Beberapa berkas sekaligus dalam satu kali proses, hasilnya langsung bisa diunduh.",
  },
  {
    icon: MousePointer2,
    title: "Tanpa Instalasi",
    desc: "Semua berjalan di browser, tidak perlu memasang aplikasi tambahan apa pun.",
  },
];

function extensionsFromAccept(accept: string): string[] {
  return accept
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.startsWith("."));
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ToolWorkspace({
  title,
  titleAccent,
  description,
  accent,
  accept,
  multiple = true,
  uploadLabel,
  uploadSubLabel,
  actionLabel,
  endpoint,
  background = false,
  buildFormData,
  options,
  note,
  features = DEFAULT_FEATURES,
}: ToolWorkspaceProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const uploadRef = useRef<FileUploadZoneRef>(null);

  const theme = ACCENTS[accent];
  const allowed = extensionsFromAccept(accept);

  const {
    convert,
    cancel,
    reset,
    isProcessing,
    progress,
    statusMessage,
    error,
    result,
  } = useUniversalConvert();

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const accepted = list.filter((file) =>
      allowed.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
    const skipped = list.length - accepted.length;

    setRejected(
      skipped > 0
        ? `${skipped} berkas dilewati karena bukan ${allowed.join(", ")}`
        : null
    );

    if (accepted.length === 0) return;

    reset();
    setFiles((previous) => (multiple ? [...previous, ...accepted] : accepted.slice(0, 1)));
  };

  const removeFile = (index: number) => {
    setFiles((previous) => previous.filter((_, i) => i !== index));
    setRejected(null);
  };

  const handleSubmit = async () => {
    if (files.length === 0 || isProcessing) return;

    let formData: FormData;
    try {
      formData = buildFormData(files);
    } catch (err) {
      setRejected(err instanceof Error ? err.message : "Pengaturan belum lengkap");
      return;
    }

    setRejected(null);
    await convert({ endpoint, formData, background });
  };

  const handleReset = () => {
    setFiles([]);
    setRejected(null);
    setIsPreviewOpen(false);
    reset();
    uploadRef.current?.reset();
  };

  // Hasil bisa berupa PDF, gambar, dokumen Office, atau ZIP; pratinjau hanya
  // masuk akal untuk PDF
  const resultIsPdf = result?.fileName.toLowerCase().endsWith(".pdf") ?? false;

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div
          className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] ${theme.blob}`}
        />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-6 shadow-sm ${theme.badge}`}
          >
            <ShieldCheck size={14} />
            <span>Aman &amp; Otomatis Dihapus</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            {title}
            <span className={theme.text}>{titleAccent}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            {description}
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          {!result ? (
            <div className="p-2">
              <FileUploadZone
                ref={uploadRef}
                isDragging={isDragging}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
                }}
                onFileChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                }}
                multiple={multiple}
                accept={accept}
                label={uploadLabel}
                subLabel={uploadSubLabel}
              />

              <div className="p-6 pt-0">
                {files.length > 0 && (
                  <ul className="space-y-3 mb-6">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100 dark:border-slate-600"
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center ${theme.softBg} ${theme.iconText}`}
                        >
                          <FileText size={22} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-bold truncate text-slate-800 dark:text-slate-200">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
                        </div>
                        {!isProcessing && (
                          <button
                            onClick={() => removeFile(index)}
                            aria-label={`Hapus ${file.name}`}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {files.length > 0 && options && <div className="mb-6">{options}</div>}

                {(error || rejected) && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{error || rejected}</span>
                  </div>
                )}

                {isProcessing && (
                  <div className="mb-2">
                    <ProgressBar
                      progress={progress}
                      label={(statusMessage || "Memproses").toUpperCase()}
                    />
                    <button
                      onClick={cancel}
                      className="w-full py-3 mb-4 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                    >
                      Batalkan
                    </button>
                  </div>
                )}

                {files.length > 0 && (
                  <>
                    {note && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 text-center leading-relaxed">
                        {note}
                      </p>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={isProcessing}
                      className={`w-full py-5 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group ${theme.button}`}
                    >
                      {isProcessing ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Zap size={20} className="group-hover:scale-125 transition-transform" />
                      )}
                      <span className="text-lg">{actionLabel}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 dark:text-green-300">Selesai</p>
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
                  onClick={handleReset}
                  className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 font-semibold transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Mulai Lagi
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center group">
                <div
                  className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${theme.iconText}`}
                >
                  <Icon size={20} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            );
          })}
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
