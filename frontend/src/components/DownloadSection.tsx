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
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-green-800">
                Berhasil mengecilkan file sebesar{" "}
                <span className="text-green-600">
                  {compressionStats.percentage.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Ukuran asli:</span>
                <span className="font-semibold text-slate-700">
                  {compressionStats.originalMB.toFixed(2)} MB
                </span>
              </div>
              <span className="text-slate-400">→</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Ukuran baru:</span>
                <span className="font-semibold text-slate-700">
                  {compressionStats.compressedMB.toFixed(2)} MB
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-bold text-[10px]">
                  -{compressionStats.savedMB.toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PDF Thumbnail Preview */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2.5">
            Pratinjau Dokumen
          </label>
          <PdfThumbnail
            pdfUrl={downloadUrl}
            fileName={`${finalFileName}.pdf`}
            onPreviewClick={() => setIsPreviewOpen(true)}
            showPreviewButton={true}
          />
          <p className="text-xs text-slate-400 mt-2 text-center">
            Klik thumbnail atau tombol "Lihat Pratinjau" untuk melihat dokumen lengkap
          </p>
        </div>

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
            placeholder={defaultName}
          />
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span>File akan diunduh sebagai:</span>
            <span className="font-semibold text-slate-600">
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
            className="px-6 py-4 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 font-semibold transition-all flex items-center gap-2"
          >
            <Eye size={18} />
            Lihat Pratinjau
          </button>
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

