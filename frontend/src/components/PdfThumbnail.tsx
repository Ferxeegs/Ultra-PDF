"use client";

import { useState, useEffect } from "react";
import { FileText, Eye } from "lucide-react";

interface PdfThumbnailProps {
  pdfUrl: string;
  fileName?: string;
  onPreviewClick?: () => void;
  showPreviewButton?: boolean;
}

export default function PdfThumbnail({
  pdfUrl,
  fileName = "preview.pdf",
  onPreviewClick,
  showPreviewButton = true,
}: PdfThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  useEffect(() => {
    // Create a canvas to render first page of PDF as thumbnail
    const generateThumbnail = async () => {
      try {
        setIsLoading(true);
        setError(false);

        // Use PDF.js to render first page
        const pdfjsLib = await import("pdfjs-dist");
        
        // Set worker source - use jsdelivr CDN which is more reliable
        const version = pdfjsLib.version || "5.4.530";
        // Try jsdelivr first (more reliable than cdnjs)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        // Load PDF with error handling
        const loadingTask = pdfjsLib.getDocument({ 
          url: pdfUrl,
          verbosity: 0, // Suppress console warnings
        });
        const pdf = await loadingTask.promise;

        // Get first page
        const page = await pdf.getPage(1);

        // Set scale for thumbnail (small size for performance)
        const scale = 0.4;
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not get canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        await page.render({
          canvas,
          viewport,
        }).promise;

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setThumbnailUrl(dataUrl);
        setIsLoading(false);
      } catch (err) {
        console.error("Error generating thumbnail:", err);
        // If thumbnail generation fails, use iframe fallback
        setUseIframeFallback(true);
        setIsLoading(false);
      }
    };

    if (pdfUrl) {
      generateThumbnail();
    }
  }, [pdfUrl]);

  return (
    <div className="relative group">
      <div 
        className="relative w-full h-48 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer transition-all hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
        onClick={onPreviewClick}
      >
        {isLoading ? (
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Memuat thumbnail...</p>
          </div>
        ) : useIframeFallback ? (
          <>
            {/* Fallback: Use iframe for thumbnail preview */}
            <iframe
              src={`${pdfUrl}#page=1&zoom=50`}
              className="w-full h-full border-0 pointer-events-none"
              title="PDF Thumbnail"
            />
            {/* Overlay with preview button */}
            {showPreviewButton && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg">
                  <Eye size={16} />
                  Lihat Pratinjau
                </div>
              </div>
            )}
          </>
        ) : thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt="PDF Thumbnail"
              className="w-full h-full object-contain"
            />
            {/* Overlay with preview button */}
            {showPreviewButton && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg">
                  <Eye size={16} />
                  Lihat Pratinjau
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-4">
            <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Gagal memuat thumbnail</p>
            {showPreviewButton && onPreviewClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewClick();
                }}
                className="mt-3 px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
              >
                Lihat Pratinjau
              </button>
            )}
          </div>
        )}
      </div>
      {fileName && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center truncate">
          {fileName}
        </p>
      )}
    </div>
  );
}

