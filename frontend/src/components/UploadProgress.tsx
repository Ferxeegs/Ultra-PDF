"use client";

import { AlertCircle, Check, FileUp, Loader2 } from "lucide-react";
import { IngestItem } from "@/hooks/useFileIngest";
import { formatBytes, formatEta, formatSpeed } from "@/utils/fileIngest";

interface UploadProgressProps {
  /** Persentase gabungan, 0-100 */
  percent: number;
  items: IngestItem[];
  loadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  currentName: string;
  /** Warna aksen agar cocok dengan identitas tiap halaman */
  accent?: "blue" | "emerald" | "purple" | "pink";
  title?: string;
}

const ACCENTS = {
  blue: {
    ring: "text-blue-600 dark:text-blue-400",
    bar: "from-blue-500 to-indigo-600",
    chip: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    icon: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  },
  emerald: {
    ring: "text-emerald-600 dark:text-emerald-400",
    bar: "from-emerald-500 to-teal-600",
    chip: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  },
  purple: {
    ring: "text-purple-600 dark:text-purple-400",
    bar: "from-purple-500 to-fuchsia-600",
    chip: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    icon: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
  },
  pink: {
    ring: "text-pink-600 dark:text-pink-400",
    bar: "from-pink-500 to-rose-600",
    chip: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
    icon: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400",
  },
} as const;

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Panel progres unggahan berkas ke penyimpanan browser.
 *
 * Menampilkan cincin persentase gabungan, kecepatan, perkiraan sisa waktu, dan
 * status tiap berkas supaya user tahu persis apa yang sedang terjadi.
 */
export default function UploadProgress({
  percent,
  items,
  loadedBytes,
  totalBytes,
  speed,
  eta,
  currentName,
  accent = "blue",
  title = "Mengunggah Berkas",
}: UploadProgressProps) {
  const theme = ACCENTS[accent];
  const rounded = Math.min(100, Math.round(percent));
  const doneCount = items.filter((item) => item.status === "done").length;
  const hasError = items.some((item) => item.status === "error");
  const detail = [formatSpeed(speed), formatEta(eta)].filter(Boolean).join(" · ");

  return (
    <div className="p-8">
      <div className="flex items-center gap-6">
        {/* Cincin persentase */}
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              className="stroke-slate-200 dark:stroke-slate-700"
            />
            <circle
              cx="40"
              cy="40"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - rounded / 100)}
              className={`stroke-current transition-all duration-300 ease-out ${theme.ring}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
              {rounded}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileUp size={16} className={theme.ring} />
            <h3 className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-slate-200">
              {title}
            </h3>
            <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${theme.chip}`}>
              {doneCount}/{items.length} berkas
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-3">
            {rounded >= 100 ? "Menyiapkan editor..." : currentName || "Membaca berkas..."}
          </p>

          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-300 ease-out relative`}
              style={{ width: `${rounded}%` }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer -translate-x-full" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            <span>
              {formatBytes(loadedBytes)} / {formatBytes(totalBytes)}
            </span>
            <span>{detail}</span>
          </div>
        </div>
      </div>

      {/* Daftar berkas: hanya berguna saat memang lebih dari satu */}
      {items.length > 1 && (
        <ul className="mt-6 space-y-2 max-h-44 overflow-y-auto pr-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${theme.icon}`}>
                {item.status === "done" ? (
                  <Check size={14} />
                ) : item.status === "error" ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : item.status === "uploading" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileUp size={14} className="opacity-50" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {item.name}
                </p>
                <div className="mt-1 w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-1 rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-300 ease-out`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                {item.status === "error" ? "gagal" : `${item.percent}%`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasError && (
        <p className="mt-4 text-xs font-semibold text-red-500 flex items-center gap-2">
          <AlertCircle size={14} />
          Sebagian berkas gagal disimpan. Silakan coba lagi.
        </p>
      )}
    </div>
  );
}
