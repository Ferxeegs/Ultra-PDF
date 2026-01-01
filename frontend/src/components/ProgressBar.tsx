"use client";

interface ProgressBarProps {
  progress: number;
  label?: string; // Optional label, default untuk merge PDF
}

export default function ProgressBar({ progress, label = "MENGGABUNGKAN FILE..." }: ProgressBarProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center text-xs font-bold text-blue-600 mb-3">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
          {label}
        </span>
        <span className="px-2.5 py-1 bg-blue-100 rounded-full">
          {progress}%
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${progress}%` }}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  );
}

