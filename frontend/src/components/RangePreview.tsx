"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FileText, ZoomIn, ChevronUp, X, Files } from "lucide-react";

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

export default function RangePreview({ pdfUrl, totalPages, ranges, fixedRangeSize }: RangePreviewProps) {
  const [pagePreviews, setPagePreviews] = useState<Map<number, PagePreview>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRanges, setExpandedRanges] = useState<Set<number>>(new Set());
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [visibleRanges, setVisibleRanges] = useState<Set<number>>(new Set());
  const rangeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfRef = useRef<any>(null);

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

  useEffect(() => {
    const initPdf = async () => {
      if (!pdfUrl || pdfRef.current) return;
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, verbosity: 0 });
        pdfRef.current = await loadingTask.promise;
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading PDF:", error);
        setIsLoading(false);
      }
    };
    initPdf();
  }, [pdfUrl]);

  const generatePagePreview = useCallback(async (pageNum: number): Promise<PagePreview | null> => {
    if (!pdfRef.current || pageNum < 1 || pageNum > totalPages) return null;
    if (pagePreviews.has(pageNum)) return pagePreviews.get(pageNum) || null;

    try {
      const page = await pdfRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.6 }); // Skala sedikit lebih kecil untuk efisiensi
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const preview: PagePreview = { pageNumber: pageNum, thumbnailUrl: dataUrl, isLoading: false };
      setPagePreviews(prev => new Map(prev).set(pageNum, preview));
      return preview;
    } catch (error) {
      const preview: PagePreview = { pageNumber: pageNum, thumbnailUrl: null, isLoading: false };
      setPagePreviews(prev => new Map(prev).set(pageNum, preview));
      return preview;
    }
  }, [totalPages, pagePreviews]);

  // Logic batching & Intersection Observer tetap dipertahankan...
  useEffect(() => {
    if (!pdfRef.current || isLoading || visibleRanges.size === 0) return;
    const generateVisiblePreviews = async () => {
      const pagesToGenerate = new Set<number>();
      visibleRanges.forEach((rangeIndex) => {
        const range = allRanges[rangeIndex];
        if (!range) return;
        pagesToGenerate.add(range.start);
        pagesToGenerate.add(range.end);
        if (expandedRanges.has(rangeIndex)) {
          for (let i = range.start; i <= range.end; i++) pagesToGenerate.add(i);
        }
      });
      const pagesArray = Array.from(pagesToGenerate).filter(p => !pagePreviews.has(p));
      for (let i = 0; i < pagesArray.length; i += 3) {
        const batch = pagesArray.slice(i, i + 3);
        await Promise.all(batch.map(pageNum => generatePagePreview(pageNum)));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    };
    generateVisiblePreviews();
  }, [visibleRanges, expandedRanges, isLoading, allRanges, generatePagePreview, pagePreviews]);

  useEffect(() => {
    if (allRanges.length === 0 || isLoading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const rangeIndex = parseInt(entry.target.getAttribute('data-range-index') || '-1');
        if (entry.isIntersecting && rangeIndex !== -1) {
          setVisibleRanges(prev => new Set(prev).add(rangeIndex));
        }
      });
    }, { rootMargin: '400px', threshold: 0.01 });

    const timeoutId = setTimeout(() => {
      rangeRefs.current.forEach((ref) => ref && observer.observe(ref));
    }, 200);
    return () => { clearTimeout(timeoutId); observer.disconnect(); };
  }, [allRanges.length, isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <FileText className="absolute inset-0 m-auto text-blue-500" size={24} />
        </div>
        <p className="mt-4 font-medium text-slate-600 dark:text-slate-400">Menyiapkan preview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {allRanges.map((range, rangeIndex) => {
        const isExpanded = expandedRanges.has(rangeIndex);
        const pageCount = range.end - range.start + 1;
        
        return (
          <div 
            key={rangeIndex} 
            ref={(el) => { if (el) rangeRefs.current.set(rangeIndex, el); }}
            data-range-index={rangeIndex}
            className="group animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {/* Header: Judul & Badge */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold">
                  {rangeIndex + 1}
                </span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Halaman {range.start} — {range.end}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  {pageCount} Halaman
                </span>
              </div>
              
              {pageCount > 1 && (
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedRanges);
                    isExpanded ? newExpanded.delete(rangeIndex) : newExpanded.add(rangeIndex);
                    setExpandedRanges(newExpanded);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 transition-all shadow-sm"
                >
                  {isExpanded ? (
                    <><ChevronUp size={14} /> Ringkaskan</>
                  ) : (
                    <><Files size={14} /> Lihat Semua</>
                  )}
                </button>
              )}
            </div>

            {/* Container Utama */}
            <div className={`
              relative overflow-hidden transition-all duration-300 rounded-2xl border-2
              ${isExpanded 
                ? 'bg-white dark:bg-slate-900/50 border-blue-100 dark:border-blue-900/30 p-6' 
                : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700'}
            `}>
              
              {!isExpanded ? (
                /* VIEW RINGKAS: Start & End */
                <div className="flex items-center justify-center gap-8 py-2">
                   <ThumbnailCard 
                    pageNum={range.start} 
                    preview={pagePreviews.get(range.start)} 
                    onZoom={() => setZoomedPage(range.start)}
                    loading={!visibleRanges.has(rangeIndex)}
                  />
                  
                  {pageCount > 1 && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        +{pageCount - 2} Hal
                      </span>
                    </div>
                  )}

                  {pageCount > 1 && (
                    <ThumbnailCard 
                      pageNum={range.end} 
                      preview={pagePreviews.get(range.end)} 
                      onZoom={() => setZoomedPage(range.end)}
                      loading={!visibleRanges.has(rangeIndex)}
                    />
                  )}
                </div>
              ) : (
                /* VIEW SEMUA: Grid Layout */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {Array.from({ length: pageCount }, (_, i) => {
                    const pageNum = range.start + i;
                    return (
                      <div key={pageNum} className="flex flex-col items-center gap-2">
                        <ThumbnailCard 
                          pageNum={pageNum} 
                          preview={pagePreviews.get(pageNum)} 
                          onZoom={() => setZoomedPage(pageNum)}
                          size="small"
                        />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Hal {pageNum}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Modal Zoom tetap sama namun dengan overlay lebih gelap */}
      {zoomedPage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setZoomedPage(null)}>
          <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600"><FileText size={20}/></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Pratinjau Halaman {zoomedPage}</h3>
                </div>
              </div>
              <button onClick={() => setZoomedPage(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe src={`${pdfUrl}#page=${zoomedPage}&toolbar=0&navpanes=0`} className="w-full h-full border-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Komponen Thumbnail kecil yang reusable
 */
function ThumbnailCard({ pageNum, preview, onZoom, size = "normal", loading = false }: any) {
  const isSmall = size === "small";
  
  return (
    <div className={`relative group/card ${isSmall ? 'w-full' : 'w-[140px] sm:w-[160px]'}`}>
      <div className={`
        relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm
        ${preview?.thumbnailUrl ? 'border-slate-200 dark:border-slate-700 group-hover/card:border-blue-400 group-hover/card:shadow-lg group-hover/card:-translate-y-1' : 'border-slate-100 dark:border-slate-800'}
        bg-white dark:bg-slate-900
      `}>
        {loading || (preview?.isLoading && !preview?.thumbnailUrl) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 animate-pulse">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : preview?.thumbnailUrl ? (
          <img 
            src={preview.thumbnailUrl} 
            alt={`Hal ${pageNum}`} 
            className="w-full h-full object-cover cursor-pointer" 
            onClick={onZoom}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
            <FileText size={isSmall ? 24 : 32} />
          </div>
        )}

        {/* Overlay Zoom on Hover */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover/card:bg-blue-600/10 transition-colors pointer-events-none" />
        <button
          onClick={onZoom}
          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 group-hover/card:opacity-100 transition-all hover:scale-110 active:scale-95"
        >
          <ZoomIn size={14} className="text-blue-600 dark:text-blue-400" />
        </button>
      </div>
      
      {!isSmall && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-bold rounded-full shadow-lg z-10">
          {pageNum}
        </div>
      )}
    </div>
  );
}

