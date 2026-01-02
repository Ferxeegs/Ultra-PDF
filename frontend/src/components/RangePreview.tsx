"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FileText, ZoomIn, ChevronDown, ChevronUp, X } from "lucide-react";

interface Range {
  start: number;
  end: number;
}

interface RangePreviewProps {
  pdfUrl: string;
  totalPages: number;
  ranges: Range[];
  fixedRangeSize?: number;
}

interface PagePreview {
  pageNumber: number;
  thumbnailUrl: string | null;
  isLoading: boolean;
}

export default function RangePreview({
  pdfUrl,
  totalPages,
  ranges,
  fixedRangeSize,
}: RangePreviewProps) {
  // All hooks must be called in the same order every render
  const [pagePreviews, setPagePreviews] = useState<Map<number, PagePreview>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRanges, setExpandedRanges] = useState<Set<number>>(new Set());
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [visibleRanges, setVisibleRanges] = useState<Set<number>>(new Set());
  const rangeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfRef = useRef<any>(null);

  // Generate ranges from fixed range size if provided - use useMemo to prevent recalculation
  const allRanges = useMemo(() => {
    if (fixedRangeSize) {
      const generatedRanges: Range[] = [];
      for (let i = 1; i <= totalPages; i += fixedRangeSize) {
        generatedRanges.push({
          start: i,
          end: Math.min(i + fixedRangeSize - 1, totalPages),
        });
      }
      return generatedRanges;
    }
    return ranges;
  }, [fixedRangeSize, totalPages, ranges]);

  // Initialize PDF once
  useEffect(() => {
    const initPdf = async () => {
      if (!pdfUrl || pdfRef.current) return;
      
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ 
          url: pdfUrl,
          verbosity: 0,
        });
        pdfRef.current = await loadingTask.promise;
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading PDF:", error);
        setIsLoading(false);
      }
    };

    initPdf();
  }, [pdfUrl]);

  // Generate preview for a single page
  const generatePagePreview = useCallback(async (pageNum: number): Promise<PagePreview | null> => {
    if (!pdfRef.current || pageNum < 1 || pageNum > totalPages) return null;
    
    // Check if already generated
    if (pagePreviews.has(pageNum)) {
      return pagePreviews.get(pageNum) || null;
    }

    try {
      const page = await pdfRef.current.getPage(pageNum);
      const scale = 0.8;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const preview: PagePreview = {
        pageNumber: pageNum,
        thumbnailUrl: dataUrl,
        isLoading: false,
      };

      setPagePreviews(prev => new Map(prev).set(pageNum, preview));
      return preview;
    } catch (error) {
      console.warn(`Error generating preview for page ${pageNum}:`, error);
      const preview: PagePreview = {
        pageNumber: pageNum,
        thumbnailUrl: null,
        isLoading: false,
      };
      setPagePreviews(prev => new Map(prev).set(pageNum, preview));
      return preview;
    }
  }, [pdfRef, totalPages, pagePreviews]);

  // Generate previews for visible ranges only
  useEffect(() => {
    if (!pdfRef.current || isLoading || visibleRanges.size === 0) return;

    const generateVisiblePreviews = async () => {
      const pagesToGenerate = new Set<number>();
      
      visibleRanges.forEach((rangeIndex) => {
        const range = allRanges[rangeIndex];
        if (!range) return;
        
        pagesToGenerate.add(range.start);
        if (range.end !== range.start) {
          pagesToGenerate.add(range.end);
        }
        
        // If expanded, generate all pages
        if (expandedRanges.has(rangeIndex)) {
          for (let i = range.start; i <= range.end; i++) {
            pagesToGenerate.add(i);
          }
        }
      });

      // Generate previews in batches to avoid blocking
      const pagesArray = Array.from(pagesToGenerate);
      const batchSize = 3; // Generate 3 previews at a time
      
      for (let i = 0; i < pagesArray.length; i += batchSize) {
        const batch = pagesArray.slice(i, i + batchSize);
        await Promise.all(batch.map(pageNum => generatePagePreview(pageNum)));
        
        // Small delay to allow UI to update
        if (i + batchSize < pagesArray.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    };

    generateVisiblePreviews();
  }, [visibleRanges, expandedRanges, pdfRef, isLoading, allRanges, generatePagePreview]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (allRanges.length === 0 || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const rangeIndex = parseInt(entry.target.getAttribute('data-range-index') || '-1');
          if (rangeIndex === -1) return;

          if (entry.isIntersecting) {
            setVisibleRanges(prev => new Set(prev).add(rangeIndex));
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before range is visible
        threshold: 0.01,
      }
    );

    // Observe all range containers after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      rangeRefs.current.forEach((ref: HTMLDivElement) => {
        if (ref) observer.observe(ref);
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [allRanges.length, isLoading]);

  const toggleRange = (rangeIndex: number) => {
    const newExpanded = new Set(expandedRanges);
    if (newExpanded.has(rangeIndex)) {
      newExpanded.delete(rangeIndex);
    } else {
      newExpanded.add(rangeIndex);
      // Ensure range is visible when expanded
      setVisibleRanges(prev => new Set(prev).add(rangeIndex));
    }
    setExpandedRanges(newExpanded);
  };

  const getPagePreview = (pageNumber: number): PagePreview | null => {
    return pagePreviews.get(pageNumber) || null;
  };

  // Set initial visible ranges (first 5 ranges) - MUST be before any return statement
  useEffect(() => {
    if (allRanges.length > 0 && visibleRanges.size === 0) {
      const initialVisible = new Set<number>();
      for (let i = 0; i < Math.min(5, allRanges.length); i++) {
        initialVisible.add(i);
      }
      setVisibleRanges(initialVisible);
    }
  }, [allRanges.length, visibleRanges.size]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 dark:border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Memuat preview halaman...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allRanges.map((range, rangeIndex) => {
        const isExpanded = expandedRanges.has(rangeIndex);
        const startPreview = getPagePreview(range.start);
        const endPreview = getPagePreview(range.end);
        const hasMiddlePages = range.end - range.start > 1;
        const isVisible = visibleRanges.has(rangeIndex);
        const isRangeLoading = !isVisible || (isVisible && !startPreview && range.start <= totalPages);

        return (
          <div 
            key={rangeIndex} 
            className="space-y-2"
            ref={(el: HTMLDivElement | null) => {
              if (el) rangeRefs.current.set(rangeIndex, el);
            }}
            data-range-index={rangeIndex}
          >
            {/* Range Label */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Rentang {rangeIndex + 1}
              </h4>
              {hasMiddlePages && (
                <button
                  onClick={() => toggleRange(rangeIndex)}
                  className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <span>Sembunyikan</span>
                      <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      <span>Lihat semua halaman</span>
                      <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Range Container with Dashed Border */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/30">
              {!isExpanded ? (
                /* Compact View: Start, Ellipsis, End */
                <div className="flex items-center gap-3 justify-center">
                  {/* Start Page */}
                  <div className="flex-shrink-0 relative">
                    <div className="relative group">
                      <div className="aspect-[3/4] bg-white dark:bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-md w-[180px]">
                        {isRangeLoading && !startPreview ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-green-500 dark:border-green-400 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : startPreview?.thumbnailUrl ? (
                          <img
                            src={startPreview.thumbnailUrl}
                            alt={`Page ${range.start}`}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => setZoomedPage(range.start)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        {/* Zoom Button */}
                        <button
                          onClick={() => setZoomedPage(range.start)}
                          className="absolute top-2 right-2 w-7 h-7 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-slate-700"
                          title="Lihat preview lebih besar"
                        >
                          <ZoomIn size={14} className="text-slate-600 dark:text-slate-300" />
                        </button>
                      </div>
                      {/* Page Number */}
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-8 h-8 bg-slate-700 dark:bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {range.start}
                      </div>
                    </div>
                  </div>

                  {/* Ellipsis */}
                  {hasMiddlePages && (
                    <div className="flex items-center justify-center">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
                      </div>
                    </div>
                  )}

                  {/* End Page (only show if different from start) */}
                  {range.end !== range.start && (
                    <div className="flex-shrink-0 relative">
                      <div className="relative group">
                        <div className="aspect-[3/4] bg-white dark:bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-md w-[180px]">
                          {isRangeLoading && !endPreview ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-8 h-8 border-2 border-green-500 dark:border-green-400 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : endPreview?.thumbnailUrl ? (
                            <img
                              src={endPreview.thumbnailUrl}
                              alt={`Page ${range.end}`}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() => setZoomedPage(range.end)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                            </div>
                          )}
                          {/* Zoom Button */}
                          <button
                            onClick={() => setZoomedPage(range.end)}
                            className="absolute top-2 right-2 w-7 h-7 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-slate-700"
                            title="Lihat preview lebih besar"
                          >
                            <ZoomIn size={14} className="text-slate-600 dark:text-slate-300" />
                          </button>
                        </div>
                        {/* Page Number */}
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-8 h-8 bg-slate-700 dark:bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {range.end}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Expanded View: All Pages */
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {Array.from({ length: range.end - range.start + 1 }, (_, i) => {
                    const pageNum = range.start + i;
                    const preview = getPagePreview(pageNum);
                    return (
                      <div key={pageNum} className="flex-shrink-0 relative">
                        <div className="relative group">
                          <div className="aspect-[3/4] bg-white dark:bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-md w-[150px]">
                            {preview?.thumbnailUrl ? (
                              <img
                                src={preview.thumbnailUrl}
                                alt={`Page ${pageNum}`}
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={() => setZoomedPage(pageNum)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                              </div>
                            )}
                            {/* Zoom Button */}
                            <button
                              onClick={() => setZoomedPage(pageNum)}
                              className="absolute top-1 right-1 w-6 h-6 bg-white dark:bg-slate-800 rounded flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-slate-700"
                              title="Lihat preview lebih besar"
                            >
                              <ZoomIn size={12} className="text-slate-600 dark:text-slate-300" />
                            </button>
                          </div>
                          {/* Page Number */}
                          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-700 dark:bg-slate-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {pageNum}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Zoom Modal */}
      {zoomedPage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedPage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setZoomedPage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X size={20} />
            </button>
            {getPagePreview(zoomedPage)?.thumbnailUrl ? (
              <img
                src={getPagePreview(zoomedPage)!.thumbnailUrl!}
                alt={`Page ${zoomedPage}`}
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center">
                <FileText className="w-16 h-16 text-slate-400 dark:text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              Halaman {zoomedPage}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

