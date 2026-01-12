"use client";

interface ProgressBarProps {
  progress: number;
  label?: string; // Optional label, default untuk merge PDF
}

export default function ProgressBar({ progress, label = "MENGGABUNGKAN FILE..." }: ProgressBarProps) {
  // Gunakan Math.round agar user tidak melihat angka desimal (misal 45.23%)
  const displayProgress = Math.round(progress);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center text-xs font-bold text-blue-600 dark:text-blue-400 mb-3">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></span>
          {label}
        </span>
        <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full min-w-[50px] text-center">
          {displayProgress}%
        </span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 dark:from-blue-600 to-indigo-600 dark:to-indigo-700 h-3 rounded-full transition-all duration-500 ease-linear shadow-sm relative"
          style={{ width: `${progress}%` }}
        >
          {/* Efek kilau (shimmer) agar bar terlihat "hidup" saat diam */}
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer -translate-x-full"></div>
        </div>
      </div>
    </div>
  );
}

