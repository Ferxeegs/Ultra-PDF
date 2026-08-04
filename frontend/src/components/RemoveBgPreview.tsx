"use client";

import { CheckCircle2, Sparkles } from "lucide-react";

interface RemoveBgPreviewProps {
  originalUrl: string;
  resultUrl: string;
  fileName: string;
}

const checkerboardStyle: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  backgroundImage: `
    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
  `,
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
};

function PreviewPanel({
  label,
  badgeClass,
  children,
}: {
  label: string;
  badgeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${badgeClass}`}
        >
          {label}
        </span>
      </div>
      <div className="relative flex-1 min-h-[220px] sm:min-h-[280px] rounded-2xl overflow-hidden ring-1 ring-slate-200/80 dark:ring-slate-600/80 shadow-inner">
        {children}
      </div>
    </div>
  );
}

export default function RemoveBgPreview({ originalUrl, resultUrl, fileName }: RemoveBgPreviewProps) {
  return (
    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start gap-3 mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-purple-50 dark:from-emerald-950/40 dark:to-purple-950/30 border border-emerald-100/80 dark:border-emerald-800/40">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={22} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 text-left">
          <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
            Background berhasil dihapus
            <Sparkles size={16} className="text-purple-500 dark:text-purple-400" />
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={fileName}>
            {fileName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <PreviewPanel
          label="Asli"
          badgeClass="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl}
              alt="Gambar asli"
              className="max-w-full max-h-[min(360px,50vh)] w-auto h-auto object-contain rounded-lg shadow-lg"
            />
          </div>
        </PreviewPanel>

        <PreviewPanel
          label="Hasil PNG"
          badgeClass="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
        >
          <div
            className="absolute inset-0 flex items-center justify-center p-4 dark:[background-color:#1e293b]"
            style={checkerboardStyle}
          >
            <div
              className="hidden dark:block absolute inset-0 opacity-40"
              style={{
                ...checkerboardStyle,
                backgroundColor: "#1e293b",
                backgroundImage: `
                  linear-gradient(45deg, #334155 25%, transparent 25%),
                  linear-gradient(-45deg, #334155 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #334155 75%),
                  linear-gradient(-45deg, transparent 75%, #334155 75%)
                `,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Hasil tanpa background"
              className="relative z-10 max-w-full max-h-[min(360px,50vh)] w-auto h-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            />
          </div>
        </PreviewPanel>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Kotak abu-abu menandakan area transparan pada PNG
      </p>
    </div>
  );
}
