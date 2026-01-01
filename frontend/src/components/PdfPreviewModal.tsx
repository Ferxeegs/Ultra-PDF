"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  fileName?: string;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  fileName = "preview.pdf",
}: PdfPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      setIsLoading(true);
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ paddingTop: '4rem', paddingBottom: '1rem' }}
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-7xl max-h-[calc(100vh-5rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">Pratinjau PDF</h3>
            {fileName && (
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
                {fileName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex-shrink-0 ml-3"
            aria-label="Tutup pratinjau"
          >
            <X size={20} />
          </button>
        </div>

        {/* PDF Preview */}
        <div className="flex-1 overflow-hidden relative bg-slate-100 dark:bg-slate-900">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=page-width`}
            className="w-full h-full border-0"
            title="PDF Preview"
            onLoad={handleIframeLoad}
          />
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white dark:bg-slate-800 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Memuat pratinjau...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gunakan kontrol di atas untuk zoom, scroll, dan navigasi
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Tekan <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> untuk menutup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

