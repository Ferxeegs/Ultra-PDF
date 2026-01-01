"use client";

import { useState } from "react";
import { Download, RotateCcw, Eye } from "lucide-react";
import PdfPreviewModal from "./PdfPreviewModal";
import PdfThumbnail from "./PdfThumbnail";

interface DownloadSectionProps {
  downloadUrl: string;
  fileName: string;
  onFileNameChange: (name: string) => void;
  onReset: () => void;
  originalSize?: number | null;
  compressedSize?: number | null;
  defaultFileName?: string;
}

export default function DownloadSection({
  downloadUrl,
  fileName,
  onFileNameChange,
  onReset,
  originalSize,
  compressedSize,
  defaultFileName,
}: DownloadSectionProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Calculate compression stats
  const compressionStats = originalSize && compressedSize ? {
    savedBytes: originalSize - compressedSize,
    savedMB: (originalSize - compressedSize) / 1024 / 1024,
    percentage: ((originalSize - compressedSize) / originalSize) * 100,
    originalMB: originalSize / 1024 / 1024,
    compressedMB: compressedSize / 1024 / 1024,
  } : null;

  // Determine default filename: if compression stats exist, it's compress page, otherwise merge page
  const defaultName = defaultFileName || (compressionStats ? "pdf-compressed" : "pdf-merged");
  const finalFileName = fileName.trim() || defaultName;

  return (
    <>
      <div className="space-y-5">
        {/* Compression Stats */}
        {compressionStats && compressionStats.savedBytes > 0 && (
          <div className="bg-gradient-to-r from-green-50 dark:from-green-900/20 to-emerald-50 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-green-800 dark:text-green-300">
                Berhasil mengecilkan file sebesar{" "}
                <span className="text-green-600 dark:text-green-400">
                  {compressionStats.percentage.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">Ukuran asli:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {compressionStats.originalMB.toFixed(2)} MB
                </span>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">Ukuran baru:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {compressionStats.compressedMB.toFixed(2)} MB
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold text-[10px]">
                  -{compressionStats.savedMB.toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PDF Thumbnail Preview */}
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Pratinjau Dokumen
          </label>
          <PdfThumbnail
            pdfUrl={downloadUrl}
            fileName={`${finalFileName}.pdf`}
            onPreviewClick={() => setIsPreviewOpen(true)}
            showPreviewButton={true}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            Klik thumbnail atau tombol "Lihat Pratinjau" untuk melihat dokumen lengkap
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Nama File
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
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
            className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
            placeholder={defaultName}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
            <span>File akan diunduh sebagai:</span>
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {finalFileName}.pdf
            </span>
            {/* {compressionStats && compressionStats.savedBytes > 0 && (
              <>
                <span className="mx-1">•</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-semibold text-[10px]">
                  Hemat {compressionStats.savedMB.toFixed(2)} MB
                </span>
              </>
            )} */}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-600 font-semibold transition-all flex items-center gap-2"
          >
            <Eye size={18} />
            Lihat Pratinjau
          </button>
          <a
            href={downloadUrl}
            download={`${finalFileName}.pdf`}
            className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 dark:hover:from-green-600 dark:hover:to-emerald-600 transition-all shadow-lg shadow-green-200/50 dark:shadow-green-900/50 hover:shadow-xl hover:shadow-green-300/50 dark:hover:shadow-green-800/50 transform hover:scale-[1.02]"
          >
            <Download size={20} />
            Unduh PDF
          </a>
          <button
            onClick={onReset}
            className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 font-semibold transition-all flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={downloadUrl}
        fileName={`${finalFileName}.pdf`}
      />
    </>
  );
}

