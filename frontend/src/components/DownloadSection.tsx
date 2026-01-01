"use client";

import { Download, RotateCcw } from "lucide-react";

interface DownloadSectionProps {
  downloadUrl: string;
  fileName: string;
  onFileNameChange: (name: string) => void;
  onReset: () => void;
}

export default function DownloadSection({
  downloadUrl,
  fileName,
  onFileNameChange,
  onReset,
}: DownloadSectionProps) {
  const defaultFileName = "pdf-merged";
  const finalFileName = fileName.trim() || defaultFileName;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2.5">
          Nama File
          <span className="text-slate-400 font-normal ml-1">
            (tanpa ekstensi .pdf)
          </span>
        </label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => {
            const value = e.target.value.replace(/[^a-zA-Z0-9\s\-_]/g, "");
            onFileNameChange(value);
          }}
          className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
          placeholder={defaultFileName}
        />
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <span>File akan diunduh sebagai:</span>
          <span className="font-semibold text-slate-600">
            {finalFileName}.pdf
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <a
          href={downloadUrl}
          download={`${finalFileName}.pdf`}
          className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-200/50 hover:shadow-xl hover:shadow-green-300/50 transform hover:scale-[1.02]"
        >
          <Download size={20} />
          Unduh PDF
        </a>
        <button
          onClick={onReset}
          className="px-6 py-4 bg-white text-slate-600 border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all flex items-center gap-2"
        >
          <RotateCcw size={18} />
          Reset
        </button>
      </div>
    </div>
  );
}

