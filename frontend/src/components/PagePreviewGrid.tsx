"use client";

import { useState, useEffect } from "react";
import { Check, FileText, X, ZoomIn } from "lucide-react";

interface PagePreview {
  pageNumber: number;
  thumbnailUrl: string | null;
  isLoading: boolean;
}

interface Range {
  start: number;
  end: number;
}

interface PagePreviewGridProps {
  pdfUrl: string;
  totalPages: number;
  selectedPages: Set<number>;
  onSelectionChange: (selectedPages: Set<number>) => void;
  ranges?: Range[];
  fixedRangeSize?: number;
  showRangeIndicators?: boolean;
}

export default function PagePreviewGrid({
  pdfUrl,
  totalPages,
  selectedPages,
  onSelectionChange,
  ranges = [],
  fixedRangeSize,
  showRangeIndicators = false,
}: PagePreviewGridProps) {
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);

  // Generate pages from ranges
  const getPagesInRanges = (): Set<number> => {
    const pages = new Set<number>();
    ranges.forEach(range => {
      for (let i = range.start; i <= range.end && i <= totalPages; i++) {
        if (i >= 1) {
          pages.add(i);
        }
      }
    });
    return pages;
  };

  // Generate pages from fixed range
  const getPagesFromFixedRange = (): Set<number> => {
    const pages = new Set<number>();
    if (fixedRangeSize) {
      for (let i = 1; i <= totalPages; i++) {
        pages.add(i);
      }
    }
    return pages;
  };

  // Get range info for a page
  const getPageRangeInfo = (pageNumber: number): { rangeIndex: number; isStart: boolean; isEnd: boolean } | null => {
    if (ranges.length > 0) {
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (pageNumber >= range.start && pageNumber <= range.end) {
          return {
            rangeIndex: i,
            isStart: pageNumber === range.start,
            isEnd: pageNumber === range.end,
          };
        }
      }
    } else if (fixedRangeSize) {
      const rangeIndex = Math.floor((pageNumber - 1) / fixedRangeSize);
      const start = rangeIndex * fixedRangeSize + 1;
      const end = Math.min((rangeIndex + 1) * fixedRangeSize, totalPages);
      if (pageNumber >= start && pageNumber <= end) {
        return {
          rangeIndex,
          isStart: pageNumber === start,
          isEnd: pageNumber === end,
        };
      }
    }
    return null;
  };

  useEffect(() => {
    const generatePreviews = async () => {
      try {
        setIsLoading(true);
        const pdfjsLib = await import("pdfjs-dist");
        
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ 
          url: pdfUrl,
          verbosity: 0,
        });
        const pdf = await loadingTask.promise;

        const previews: PagePreview[] = [];
        
        // Generate preview untuk setiap halaman
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const scale = 0.8; // Scale lebih besar untuk preview yang jelas
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            } as any).promise;

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            previews.push({
              pageNumber: pageNum,
              thumbnailUrl: dataUrl,
              isLoading: false,
            });
          } catch (error) {
            console.warn(`Error generating preview for page ${pageNum}:`, error);
            previews.push({
              pageNumber: pageNum,
              thumbnailUrl: null,
              isLoading: false,
            });
          }
        }

        setPagePreviews(previews);
        setIsLoading(false);
      } catch (error) {
        console.error("Error generating page previews:", error);
        setIsLoading(false);
      }
    };

    if (pdfUrl && totalPages > 0) {
      generatePreviews();
    }
  }, [pdfUrl, totalPages]);

  const togglePage = (pageNumber: number, event?: React.MouseEvent) => {
    // Jika klik pada area zoom button, jangan toggle selection
    if (event && (event.target as HTMLElement).closest('.zoom-button')) {
      return;
    }
    const newSelection = new Set(selectedPages);
    if (newSelection.has(pageNumber)) {
      newSelection.delete(pageNumber);
    } else {
      newSelection.add(pageNumber);
    }
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    const allPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    onSelectionChange(allPages);
  };

  const deselectAll = () => {
    onSelectionChange(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Memuat preview halaman...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {selectedPages.size} dari {totalPages} halaman dipilih
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Pilih Semua
          </button>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button
            onClick={deselectAll}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Hapus Pilihan
          </button>
        </div>
      </div>

      {/* Page Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto p-1">
        {pagePreviews.map((preview) => {
          const isSelected = selectedPages.has(preview.pageNumber);
          const rangeInfo = showRangeIndicators ? getPageRangeInfo(preview.pageNumber) : null;
          const isInRange = rangeInfo !== null;
          
          // Determine border color based on selection or range
          // Priority: Range indicators override selection indicators when showRangeIndicators is active
          let borderColor = "border-slate-200 dark:border-slate-700";
          let bgColor = "bg-slate-50 dark:bg-slate-800/50";
          
          if (showRangeIndicators && isInRange) {
            // Range mode: show green border for pages in range (priority)
            borderColor = "border-green-500 dark:border-green-400";
            bgColor = "bg-green-50 dark:bg-green-900/20";
          } else if (!showRangeIndicators && isSelected) {
            // Pages mode: show blue border for selected pages
            borderColor = "border-blue-500 dark:border-blue-400";
            bgColor = "bg-blue-50 dark:bg-blue-900/20";
          }

          return (
            <div
              key={preview.pageNumber}
              onClick={(e) => !showRangeIndicators && togglePage(preview.pageNumber, e)}
              className={`
                relative group rounded-xl overflow-hidden border-2 transition-all
                ${isSelected
                  ? "shadow-lg scale-[1.02] cursor-pointer"
                  : isInRange && showRangeIndicators
                  ? "shadow-md cursor-default"
                  : "hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md cursor-pointer"
                }
                ${borderColor} ${bgColor}
              `}
            >
              {/* Thumbnail */}
              <div className="aspect-[3/4] bg-white dark:bg-slate-900 flex items-center justify-center relative min-h-[300px]">
                {preview.thumbnailUrl ? (
                  <img
                    src={preview.thumbnailUrl}
                    alt={`Page ${preview.pageNumber}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Halaman {preview.pageNumber}
                    </p>
                  </div>
                )}
                
                {/* Selection Indicator - Only show when NOT in range mode */}
                {isSelected && !showRangeIndicators && (
                  <div className="absolute top-3 right-3 w-7 h-7 bg-blue-500 dark:bg-blue-400 rounded-full flex items-center justify-center shadow-lg z-10">
                    <Check size={16} className="text-white" />
                  </div>
                )}
                
                {/* Range Indicator - Show when in range mode */}
                {isInRange && showRangeIndicators && (
                  <div className="absolute top-3 right-3 w-7 h-7 bg-green-500 dark:bg-green-400 rounded-full flex items-center justify-center shadow-lg z-10">
                    <span className="text-xs font-bold text-white">
                      {rangeInfo ? rangeInfo.rangeIndex + 1 : ""}
                    </span>
                  </div>
                )}
                
                {/* Range Start/End Indicators */}
                {isInRange && showRangeIndicators && rangeInfo && (
                  <>
                    {rangeInfo.isStart && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-green-500 dark:bg-green-400 text-white text-xs font-bold rounded shadow-lg z-10">
                        Mulai
                      </div>
                    )}
                    {rangeInfo.isEnd && (
                      <div className="absolute bottom-3 left-3 px-2 py-1 bg-green-500 dark:bg-green-400 text-white text-xs font-bold rounded shadow-lg z-10">
                        Akhir
                      </div>
                    )}
                  </>
                )}
                
                {/* Zoom Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomedPage(preview.pageNumber);
                  }}
                  className="zoom-button absolute top-3 left-3 w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-blue-50 dark:hover:bg-slate-700"
                  title="Lihat preview lebih besar"
                >
                  <ZoomIn size={16} className="text-slate-600 dark:text-slate-300" />
                </button>
                
                {/* Hover Overlay */}
                {!showRangeIndicators && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold shadow-lg">
                      {isSelected ? "Batal Pilih" : "Klik untuk Pilih"}
                    </div>
                  </div>
                )}
              </div>

              {/* Page Number */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-sm font-bold text-white text-center">
                  Halaman {preview.pageNumber}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom Modal */}
      {zoomedPage !== null && (
        <div 
          className="fixed inset-0 bg-black/80 dark:bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedPage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setZoomedPage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors z-10"
            >
              <X size={20} className="text-slate-600 dark:text-slate-300" />
            </button>

            {/* Zoomed Preview */}
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 text-center">
                Halaman {zoomedPage}
              </h3>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 max-h-[70vh] overflow-auto">
                {pagePreviews[zoomedPage - 1]?.thumbnailUrl ? (
                  <img
                    src={pagePreviews[zoomedPage - 1].thumbnailUrl || ""}
                    alt={`Page ${zoomedPage}`}
                    className="w-full h-auto object-contain mx-auto"
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Preview tidak tersedia
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

