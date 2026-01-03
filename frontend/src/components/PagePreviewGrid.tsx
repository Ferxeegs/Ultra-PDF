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

      {/* Page Grid - Compact like RangePreview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-h-[600px] overflow-y-auto p-1">
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
              className="relative group/card flex flex-col items-center gap-2"
            >
              {/* Thumbnail Card - Compact like RangePreview */}
              <div className={`
                relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm
                ${preview.thumbnailUrl 
                  ? 'border-slate-200 dark:border-slate-700 group-hover/card:border-blue-400 group-hover/card:shadow-lg group-hover/card:-translate-y-1' 
                  : 'border-slate-100 dark:border-slate-800'
                }
                ${isSelected && !showRangeIndicators
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : isInRange && showRangeIndicators
                  ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'bg-white dark:bg-slate-900'
                }
                ${!showRangeIndicators ? 'cursor-pointer' : 'cursor-default'}
              `}>
                {preview.thumbnailUrl ? (
                  <img
                    src={preview.thumbnailUrl}
                    alt={`Page ${preview.pageNumber}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
                    <FileText size={24} />
                  </div>
                )}

                {/* Selection Indicator - Only show when NOT in range mode */}
                {isSelected && !showRangeIndicators && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 dark:bg-blue-400 rounded-full flex items-center justify-center shadow-lg z-10">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                
                {/* Range Indicator - Show when in range mode */}
                {isInRange && showRangeIndicators && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 dark:bg-green-400 rounded-full flex items-center justify-center shadow-lg z-10">
                    <span className="text-[10px] font-bold text-white">
                      {rangeInfo ? rangeInfo.rangeIndex + 1 : ""}
                    </span>
                  </div>
                )}
                
                {/* Overlay Zoom on Hover */}
                <div className="absolute inset-0 bg-blue-600/0 group-hover/card:bg-blue-600/10 transition-colors pointer-events-none" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setZoomedPage(preview.pageNumber);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="zoom-button absolute top-1.5 right-1.5 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 group-hover/card:opacity-100 transition-all hover:scale-110 active:scale-95 z-10"
                  title="Lihat preview lebih besar"
                >
                  <ZoomIn size={12} className="text-blue-600 dark:text-blue-400" />
                </button>

                {/* Selection Hover Overlay - Only show when NOT in range mode */}
                {!showRangeIndicators && (
                  <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/5 transition-all flex items-center justify-center opacity-0 group-hover/card:opacity-100 pointer-events-none">
                    <div className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs font-semibold shadow-lg">
                      {isSelected ? "Batal Pilih" : "Klik untuk Pilih"}
                    </div>
                  </div>
                )}
              </div>

              {/* Page Number Badge - Below thumbnail like RangePreview */}
              <div className="px-2 py-0.5 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-bold rounded-full shadow-lg">
                {preview.pageNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom Modal - Using PDF Viewer like RangePreview */}
      {zoomedPage !== null && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setZoomedPage(null)}
        >
          <div 
            className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
                  <FileText size={20}/>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    Pratinjau Halaman {zoomedPage}
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setZoomedPage(null)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Iframe Viewport */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe 
                src={`${pdfUrl}#page=${zoomedPage}&toolbar=0&navpanes=0`} 
                className="w-full h-full border-none" 
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

