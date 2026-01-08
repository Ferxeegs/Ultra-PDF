"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { getPdfDocument } from "@/utils/pdfjs";

interface PageThumbnailProps {
  fileId: string;
  file: File;
  pageNum: number;
  scale?: number;
  className?: string;
}

const PageThumbnail = ({ fileId, file, pageNum, scale = 0.3, className = "" }: PageThumbnailProps) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRendering = useRef(false);
  const thumbnailRef = useRef<string | null>(null);
  const currentKeyRef = useRef<string>("");

  // Create unique key for this component instance
  const componentKey = `${fileId}-${pageNum}`;

  const renderPage = async () => {
    // Check if component key changed (page was moved)
    if (currentKeyRef.current !== componentKey) {
      return; // Don't render if key changed
    }
    
    if (isRendering.current || thumbnailRef.current) return;
    isRendering.current = true;
    setIsLoading(true);
    setError(false);

    try {
      // Get PDF document from cache (loads only once per file)
      const pdf = await getPdfDocument(fileId, file);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Create canvas for rendering
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      
      if (!context) {
        throw new Error("Could not get canvas context");
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      // Convert to image with lower quality for better performance
      const dataUrl = canvas.toDataURL("image/webp", 0.6);
      setThumbnail(dataUrl);
      thumbnailRef.current = dataUrl;
      
      // Cleanup page instance to free memory
      page.cleanup();
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      setError(true);
    } finally {
      setIsLoading(false);
      isRendering.current = false;
    }
  };

  useEffect(() => {
    // Update current key
    currentKeyRef.current = componentKey;
    
    // Reset state when fileId or pageNum changes
    setThumbnail(null);
    thumbnailRef.current = null;
    setError(false);
    isRendering.current = false;
    setIsLoading(false);

    // Disconnect any existing observer
    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      // Double check key hasn't changed
      if (currentKeyRef.current !== componentKey) {
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            // Check current state using refs and key
            if (currentKeyRef.current === componentKey && !isRendering.current && !thumbnailRef.current) {
              renderPage();
              observer?.disconnect(); // Stop observing once rendered
            }
          }
        },
        {
          rootMargin: "200px", // Load earlier before element is visible
        }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(setupObserver, 0);

    return () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
      // Reset rendering flag on cleanup
      if (currentKeyRef.current === componentKey) {
        isRendering.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, pageNum, componentKey]); // Include componentKey in dependencies

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {thumbnail ? (
        <img 
          src={thumbnail} 
          alt={`Page ${pageNum}`} 
          className="w-full h-full object-contain"
        />
      ) : isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800">
          <div className="w-6 h-6 border-2 border-purple-500 dark:border-purple-400 border-t-transparent rounded-full animate-spin mb-1"></div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Memuat...</p>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800">
          <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-1" />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Error</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800">
          <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-1" />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Halaman {pageNum}</p>
        </div>
      )}
    </div>
  );
};

export default PageThumbnail;

