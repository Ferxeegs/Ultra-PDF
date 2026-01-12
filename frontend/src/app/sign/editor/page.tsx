"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, PenTool, Plus, X, Eye, FileText, GripVertical, Maximize2, Type } from "lucide-react";
import { FileObject } from "@/types";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";
import SignaturePad from "@/components/SignatureCanvas";
import SignaturePreview from "@/components/SignaturePreview";
import TextToolbar, { TextPosition } from "@/components/TextToolbar";
import { indexedDBManager } from "@/utils/indexedDB";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface SignaturePosition {
  id: string;
  fileId: string;
  pageNumber: number;
  x: number; // PDF points (not percentage)
  y: number; // PDF points (not percentage)
  width: number; // PDF points
  height: number; // PDF points
  pdfPageWidth: number; // PDF points
  pdfPageHeight: number; // PDF points
}

// PDF Page Preview Component - Renders actual PDF page
function PagePreviewItem({
  fileId,
  pageNum,
  pdfFile,
  isLoading,
  positions,
  textPositions,
  sessionSignature,
  onDrop,
  onSignatureMove,
  onSignatureResize,
  onSignatureRemove,
  onTextMove,
  onTextResize,
  onTextRemove,
  onTextClick,
  onDragOver,
  signatureAspectRatio,
}: {
  fileId: string;
  pageNum: number;
  pdfFile: File | null;
  isLoading: boolean;
  positions: SignaturePosition[];
  textPositions: TextPosition[];
  sessionSignature: string | null;
  onDrop: (e: React.DragEvent, pdfOriginalSize: { width: number; height: number }, scaleFactor: number) => void;
  onSignatureMove: (id: string, x: number, y: number) => void;
  onSignatureResize: (id: string, width: number, height: number) => void;
  onSignatureRemove: (id: string) => void;
  onTextMove: (id: string, x: number, y: number) => void;
  onTextResize: (id: string, fontSize: number) => void;
  onTextRemove: (id: string) => void;
  onTextClick: (id: string, position: { x: number; y: number }) => void;
  onDragOver?: (e: React.DragEvent, pdfOriginalSize: { width: number; height: number }, scaleFactor: number) => void;
  signatureAspectRatio: number | null;
}) {
  const [draggingSignaturePos, setDraggingSignaturePos] = useState<{ x: number; y: number } | null>(null);
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 }); // Browser viewport size (pixels)
  const [pdfOriginalSize, setPdfOriginalSize] = useState({ width: 0, height: 0 }); // PDF original size (points)
  const [scaleFactor, setScaleFactor] = useState(1); // Scale between PDF and browser view
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  const hasPageSignature = positions.length > 0;
  // const [isResizing, setIsResizing] = useState(false);
  // const [resizingSignatureId, setResizingSignatureId] = useState<string | null>(null);
  // const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Load and render PDF page
  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const loadPdfPage = async () => {
      if (!pdfFile) return;

      try {
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const url = URL.createObjectURL(pdfFile);
        const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNum);
        
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        
        setPdfPage(page);

        // Wait a bit for container to be ready, then calculate scale
        // Use requestAnimationFrame to ensure DOM is ready
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!isMounted || !containerRef.current) {
          URL.revokeObjectURL(url);
          return;
        }

        // Get original PDF page dimensions in Points (PDF coordinate system)
        const viewport = page.getViewport({ scale: 1 });
        const pdfWidth = viewport.width; // Original PDF width in points
        const pdfHeight = viewport.height; // Original PDF height in points
        setPdfOriginalSize({ width: pdfWidth, height: pdfHeight });

        // Calculate scale to fit container width (with padding)
        // Use more of the available width for larger preview
        const containerWidth = Math.max(containerRef.current.clientWidth - 16, 800); // Account for padding (p-2 = 8px each side), min 800px
        const scale = Math.min(containerWidth / viewport.width, 3.2); // Max 3.2x scale for larger preview
        const scaledViewport = page.getViewport({ scale });
        
        // Store browser viewport size (pixels)
        setPageSize({ width: scaledViewport.width, height: scaledViewport.height });
        
        // Calculate scale factor: PDF points to browser pixels
        // This is the ratio: browserPixel / pdfPoint
        const calculatedScaleFactor = scaledViewport.width / pdfWidth;
        setScaleFactor(calculatedScaleFactor);

        // Render to canvas
        if (canvasRef.current && isMounted) {
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");
          if (!context) {
            URL.revokeObjectURL(url);
            return;
          }

          // Cancel previous render if exists
          if (renderTask) {
            renderTask.cancel();
          }

          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;

          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);

          // Create render task
          renderTask = page.render({
            canvasContext: context,
            viewport: scaledViewport,
          } as any);

          await renderTask.promise;
          renderTask = null;
        }

        URL.revokeObjectURL(url);
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'RenderingCancelledException') {
          // Ignore cancellation errors
          return;
        }
        console.error(`Error loading PDF page ${pageNum}:`, error);
      }
    };

    loadPdfPage();

    // Cleanup function
    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfFile, pageNum]);

  return (
    <div
      ref={containerRef}
      className="relative group"
      onDragOver={(e) => {
        // Hanya handle signature drag, bukan file drag
        const isSignatureDrag = e.dataTransfer.types.includes("text/plain") && 
                               !e.dataTransfer.types.includes("Files");
        
        if (!isSignatureDrag) {
          // Biarkan file drag di-handle oleh parent
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        if (sessionSignature && pdfOriginalSize.width > 0 && scaleFactor > 0) {
          // Update posisi signature preview secara real-time
          if (onDragOver) {
            onDragOver(e, pdfOriginalSize, scaleFactor);
          }
          
          // Calculate position untuk preview - use EXACT same calculation as drop
          const canvas = canvasRef.current;
          if (canvas) {
            const canvasRect = canvas.getBoundingClientRect();
            
            // Calculate position relative to canvas (browser pixels) - EXACT same as handleThumbnailDrop
            const dropXPixels = e.clientX - canvasRect.left;
            const dropYPixels = e.clientY - canvasRect.top;
            
            // Convert browser pixels to PDF points - EXACT same as drop
            const dropXPoints = dropXPixels / scaleFactor;
            const dropYPoints = dropYPixels / scaleFactor;
            
            // Calculate signature size - EXACT same as handleThumbnailDrop
            const signatureWidthPoints = pdfOriginalSize.width * 0.15;
            let signatureHeightPoints: number;
            if (signatureAspectRatio) {
              signatureHeightPoints = signatureWidthPoints / signatureAspectRatio;
            } else {
              const defaultAspectRatio = 800 / 300;
              signatureHeightPoints = signatureWidthPoints / defaultAspectRatio;
            }
            
            // Clamp position - EXACT same logic as handleThumbnailDrop
            const clampedX = Math.max(0, Math.min(pdfOriginalSize.width - signatureWidthPoints, dropXPoints));
            const clampedY = Math.max(0, Math.min(pdfOriginalSize.height - signatureHeightPoints, dropYPoints));
            
            setDraggingSignaturePos({ x: clampedX, y: clampedY });
          }
        }
      }}
      onDragLeave={(e) => {
        // Hanya handle signature drag
        const isSignatureDrag = e.dataTransfer.types.includes("text/plain") && 
                               !e.dataTransfer.types.includes("Files");
        
        if (!isSignatureDrag) {
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDraggingSignaturePos(null);
        }
      }}
      onDrop={(e) => {
        // Hanya handle signature drop, bukan file drop
        const isSignatureDrag = e.dataTransfer.types.includes("text/plain") && 
                               !e.dataTransfer.types.includes("Files");
        
        if (!isSignatureDrag) {
          // Biarkan file drop di-handle oleh parent
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        setDraggingSignaturePos(null);
        if (sessionSignature && pdfOriginalSize.width > 0 && scaleFactor > 0) {
          // Pass the exact same values that were used in preview
          onDrop(e, pdfOriginalSize, scaleFactor);
        }
      }}
    >
      {/* PDF Page Container */}
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-lg overflow-visible transition-all"
      >
        {isLoading || !pdfPage ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={24} />
          </div>
        ) : (
          <>
            {/* LAYER 1: Bottom Layer - PDF Canvas (PDF Viewer) */}
            <div className="flex justify-center p-2 bg-slate-50 dark:bg-slate-900 relative">
              <canvas
                ref={canvasRef}
                className="shadow-lg relative z-0"
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />
              
              {/* LAYER 2: Middle Layer - Interaction Canvas (Transparent for drop detection) */}
              {canvasRef.current && pageSize.width > 0 && (
                <div
                  ref={interactionLayerRef}
                  className="absolute z-10"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${pageSize.width}px`,
                    height: `${pageSize.height}px`,
                    pointerEvents: 'auto',
                  }}
                />
              )}
              
              {/* LAYER 3: Top Layer - Draggable Signatures */}
              {/* Preview signature saat drag */}
              {sessionSignature && draggingSignaturePos && canvasRef.current && pageSize.width > 0 && scaleFactor > 0 && (
                (() => {
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  const canvasRect = canvasRef.current?.getBoundingClientRect();
                  if (!containerRect || !canvasRect) return null;
                  
                  const canvasOffsetX = canvasRect.left - containerRect.left;
                  const canvasOffsetY = canvasRect.top - containerRect.top;
                  
                  // Calculate signature size - use EXACT same logic as handleThumbnailDrop
                  const signatureWidthPoints = pdfOriginalSize.width * 0.15;
                  
                  // Get aspect ratio - EXACT same logic as handleThumbnailDrop
                  let signatureHeightPoints: number;
                  if (signatureAspectRatio) {
                    signatureHeightPoints = signatureWidthPoints / signatureAspectRatio;
                  } else {
                    const defaultAspectRatio = 800 / 300;
                    signatureHeightPoints = signatureWidthPoints / defaultAspectRatio;
                  }
                  
                  // Convert to browser pixels - EXACT same as how drop calculates
                  const browserWidth = signatureWidthPoints * scaleFactor;
                  const browserHeight = signatureHeightPoints * scaleFactor;
                  
                  // Convert PDF points to browser pixels for position
                  // Position is top-left corner, same as drop
                  const browserX = draggingSignaturePos.x * scaleFactor;
                  const browserY = draggingSignaturePos.y * scaleFactor;
                  
                  return (
                    <div
                      className="absolute pointer-events-none z-30 opacity-70"
                      style={{
                        left: `${canvasOffsetX + browserX}px`,
                        top: `${canvasOffsetY + browserY}px`,
                        width: `${browserWidth}px`,
                        height: `${browserHeight}px`,
                      }}
                    >
                      <img
                        src={sessionSignature}
                        alt="Signature Preview"
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    </div>
                  );
                })()
              )}
              
              {canvasRef.current && pageSize.width > 0 && scaleFactor > 0 && positions.map((pos: SignaturePosition) => {
                // Convert PDF points to browser pixels
                // PDF coordinates are in points, browser needs pixels
                const browserX = (pos.x * scaleFactor);
                const browserY = (pos.y * scaleFactor);
                const browserWidth = (pos.width * scaleFactor);
                const browserHeight = (pos.height * scaleFactor);

                // Calculate position relative to container
                const containerRect = containerRef.current?.getBoundingClientRect();
                const canvasRect = canvasRef.current?.getBoundingClientRect();
                if (!containerRect || !canvasRect) return null;

                // Calculate offset: canvas is centered with padding
                const canvasOffsetX = canvasRect.left - containerRect.left;
                const canvasOffsetY = canvasRect.top - containerRect.top;

                return (
                  <div
                    key={pos.id}
                    className="absolute pointer-events-auto cursor-move group/sig z-20"
                    style={{
                      left: `${canvasOffsetX + browserX}px`,
                      top: `${canvasOffsetY + browserY}px`,
                      width: `${browserWidth}px`,
                      height: `${browserHeight}px`,
                    }}
                    onMouseDown={(e) => {
                      // Don't start drag if clicking on resize handle
                      if ((e.target as HTMLElement).closest('.resize-handle')) {
                        return;
                      }
                      e.stopPropagation();
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startPdfX = pos.x;
                      const startPdfY = pos.y;
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        if (!canvasRef.current || !scaleFactor || pdfOriginalSize.width === 0) return;
                        
                        // Calculate delta in browser pixels
                        const deltaXPixels = moveEvent.clientX - startX;
                        const deltaYPixels = moveEvent.clientY - startY;
                        
                        // Convert delta to PDF points
                        // Both browser and our storage use "from top" coordinate system
                        const deltaXPoints = deltaXPixels / scaleFactor;
                        const deltaYPoints = deltaYPixels / scaleFactor; // No inversion needed
                        
                        // Calculate new position in PDF points
                        const newPdfX = Math.max(0, Math.min(pdfOriginalSize.width - pos.width, startPdfX + deltaXPoints));
                        const newPdfY = Math.max(0, Math.min(pdfOriginalSize.height - pos.height, startPdfY + deltaYPoints));
                        
                        onSignatureMove(pos.id, newPdfX, newPdfY);
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    {sessionSignature && (
                      <>
                        <img
                          src={sessionSignature}
                          alt="Signature"
                          className="w-full h-full object-contain opacity-90 group-hover/sig:opacity-100 transition-opacity pointer-events-none"
                          draggable={false}
                        />
                        {/* Remove button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSignatureRemove(pos.id);
                          }}
                          className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover/sig:opacity-100 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 z-20 border-2 border-white dark:border-slate-900"
                          title="Hapus tanda tangan"
                        >
                          <X size={16} strokeWidth={2.5} />
                        </button>
                        {/* Resize handle */}
                        <div
                          className="resize-handle absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 active:bg-blue-700 dark:active:bg-blue-700 border-2 border-white dark:border-slate-900 rounded-md opacity-0 group-hover/sig:opacity-100 transition-all duration-200 cursor-nwse-resize z-20 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
                          title="Resize tanda tangan"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startWidth = pos.width;
                            const startHeight = pos.height;
                            const aspectRatio = startWidth / startHeight;
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              if (!scaleFactor || pdfOriginalSize.width === 0) return;
                              
                              const deltaXPixels = moveEvent.clientX - startX;
                              const deltaYPixels = moveEvent.clientY - startY;
                              
                              const deltaXPoints = deltaXPixels / scaleFactor;
                              const deltaYPoints = deltaYPixels / scaleFactor;
                              
                              // Calculate new size (maintain aspect ratio)
                              let newWidth = startWidth + deltaXPoints;
                              let newHeight = startHeight + deltaYPoints;
                              
                              if (Math.abs(deltaXPoints) > Math.abs(deltaYPoints)) {
                                newHeight = newWidth / aspectRatio;
                              } else {
                                newWidth = newHeight * aspectRatio;
                              }
                              
                              // Clamp to min/max sizes
                              const minWidth = pdfOriginalSize.width * 0.05;
                              const maxWidth = pdfOriginalSize.width * 0.4;
                              const minHeight = pdfOriginalSize.height * 0.03;
                              const maxHeight = pdfOriginalSize.height * 0.2;
                              
                              newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                              newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
                              
                              // Ensure signature doesn't go outside page bounds
                              if (pos.x + newWidth > pdfOriginalSize.width) {
                                newWidth = pdfOriginalSize.width - pos.x;
                                newHeight = newWidth / aspectRatio;
                              }
                              if (pos.y + newHeight > pdfOriginalSize.height) {
                                newHeight = pdfOriginalSize.height - pos.y;
                                newWidth = newHeight * aspectRatio;
                              }
                              
                              onSignatureResize(pos.id, newWidth, newHeight);
                            };
                            
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };
                            
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                        >
                          <Maximize2 size={14} className="text-white rotate-45" strokeWidth={2.5} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Render Text Elements */}
              {canvasRef.current && pageSize.width > 0 && scaleFactor > 0 && textPositions.map((textPos: TextPosition) => {
                // Convert PDF points to browser pixels
                const browserX = textPos.x * scaleFactor;
                const browserY = textPos.y * scaleFactor;
                const browserFontSize = textPos.fontSize * scaleFactor;

                // Calculate position relative to container
                const containerRect = containerRef.current?.getBoundingClientRect();
                const canvasRect = canvasRef.current?.getBoundingClientRect();
                if (!containerRect || !canvasRect) return null;

                // Calculate offset: canvas is centered with padding
                const canvasOffsetX = canvasRect.left - containerRect.left;
                const canvasOffsetY = canvasRect.top - containerRect.top;

                // Convert HEX to RGB for CSS
                const hexToRgb = (hex: string) => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result
                    ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`
                    : 'rgb(0, 0, 0)';
                };

                // Map font family to CSS font
                const fontFamilyMap: Record<string, string> = {
                  'Helvetica': 'Arial, Helvetica, sans-serif',
                  'TimesRoman': 'Times, "Times New Roman", serif',
                  'Courier': 'Courier, monospace',
                };

                return (
                  <div
                    key={textPos.id}
                    className="absolute pointer-events-auto cursor-move group/text z-20"
                    style={{
                      left: `${canvasOffsetX + browserX}px`,
                      top: `${canvasOffsetY + browserY}px`,
                    }}
                    onMouseDown={(e) => {
                      // Don't start drag if clicking on resize handle
                      if ((e.target as HTMLElement).closest('.text-resize-handle')) {
                        return;
                      }
                      e.stopPropagation();
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startPdfX = textPos.x;
                      const startPdfY = textPos.y;
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        if (!canvasRef.current || !scaleFactor || pdfOriginalSize.width === 0) return;
                        
                        // Calculate delta in browser pixels (screen coordinates)
                        const deltaXPixels = moveEvent.clientX - startX;
                        const deltaYPixels = moveEvent.clientY - startY;
                        
                        // CRITICAL: Convert delta from browser pixels to PDF points
                        // scaleFactor = browserPixels / pdfPoints
                        // So: pdfPoints = browserPixels / scaleFactor
                        // This ensures coordinates are stored in PDF Points, not screen pixels
                        const deltaXPoints = deltaXPixels / scaleFactor;
                        const deltaYPoints = deltaYPixels / scaleFactor;
                        
                        // Calculate new position in PDF points (always store in PDF Points)
                        const newPdfX = Math.max(0, Math.min(pdfOriginalSize.width, startPdfX + deltaXPoints));
                        const newPdfY = Math.max(0, Math.min(pdfOriginalSize.height, startPdfY + deltaYPoints));
                        
                        // Store position in PDF Points (not screen pixels) for consistency across devices
                        onTextMove(textPos.id, newPdfX, newPdfY);
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onTextClick(textPos.id, {
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                  >
                    <div
                      data-text-id={textPos.id}
                      className="group-hover/text:outline group-hover/text:outline-2 group-hover/text:outline-blue-400 dark:group-hover/text:outline-blue-500"
                      style={{
                        color: hexToRgb(textPos.color),
                        opacity: textPos.opacity / 100,
                        fontFamily: fontFamilyMap[textPos.fontFamily] || 'Arial, sans-serif',
                        fontSize: `${browserFontSize}px`,
                        lineHeight: '1', // Use 1 to minimize leading space, matching canvas textBaseline='top'
                        display: 'block',
                        margin: 0,
                        padding: 0, // Zero padding to match PDF rasterization (no hidden padding)
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {textPos.text || 'Teks Baru'}
                    </div>
                    {/* Remove button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTextRemove(textPos.id);
                      }}
                      className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover/text:opacity-100 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 z-20 border-2 border-white dark:border-slate-900"
                      title="Hapus teks"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                    {/* Resize handle (bottom-right corner) */}
                    <div
                      className="text-resize-handle absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 active:bg-blue-700 dark:active:bg-blue-700 border-2 border-white dark:border-slate-900 rounded-md opacity-0 group-hover/text:opacity-100 transition-all duration-200 cursor-nwse-resize z-20 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
                      title="Resize teks"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startFontSize = textPos.fontSize;
                        const startWidth = textPos.fontSize; // Approximate width based on font size
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          if (!scaleFactor || pdfOriginalSize.width === 0) return;
                          
                          const deltaXPixels = moveEvent.clientX - startX;
                          const deltaYPixels = moveEvent.clientY - startY;
                          
                          // Use the larger delta (width or height change)
                          const deltaPoints = Math.max(
                            Math.abs(deltaXPixels / scaleFactor),
                            Math.abs(deltaYPixels / scaleFactor)
                          );
                          
                          // Calculate new font size proportionally
                          const sizeChange = deltaXPixels > 0 ? deltaPoints : -deltaPoints;
                          let newFontSize = startFontSize + sizeChange;
                          
                          // Clamp to min/max sizes
                          const minFontSize = 8;
                          const maxFontSize = 72;
                          newFontSize = Math.max(minFontSize, Math.min(maxFontSize, newFontSize));
                          
                          onTextResize(textPos.id, newFontSize);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <Maximize2 size={14} className="text-white rotate-45" strokeWidth={2.5} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Page Number Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs font-bold rounded z-10">
          Halaman {pageNum}
        </div>

        {/* Signature Indicator */}
        {hasPageSignature && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded flex items-center gap-1 z-10">
            <span>✓</span>
            <span>{positions.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SignEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fileObjects, setFileObjects] = useState<FileObject[]>([]);
  const [downloadFileName, setDownloadFileName] = useState("pdf-signed");
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Global signature untuk sesi (bukan per file)
  const [sessionSignature, setSessionSignature] = useState<string | null>(null);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [signatureAspectRatio, setSignatureAspectRatio] = useState<number | null>(null);
  
  // Preview state
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewPageNumber, setPreviewPageNumber] = useState<number | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  
  // Current viewing state - for main viewer
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = useState<number>(1);
  const [pageThumbnails, setPageThumbnails] = useState<Map<string, string>>(new Map()); // key: `${fileId}-${pageNum}`
  
  // Signature positions per file/page
  const [signaturePositions, setSignaturePositions] = useState<Map<string, SignaturePosition[]>>(new Map());
  // Text positions per file/page
  const [textPositions, setTextPositions] = useState<Map<string, TextPosition[]>>(new Map());
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedTextToolbarPosition, setSelectedTextToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTextToolbar, setShowTextToolbar] = useState(true); // State untuk mengontrol visibility toolbar
  const [pdfPages, setPdfPages] = useState<Map<string, number>>(new Map());
  
  // Refs for thumbnail scrolling
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const mainViewerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const currentPageNumberRef = useRef<number>(1);
  const currentFileIdRef = useRef<string | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    currentPageNumberRef.current = currentPageNumber;
  }, [currentPageNumber]);

  useEffect(() => {
    currentFileIdRef.current = currentFileId;
  }, [currentFileId]);

  // Close text toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedTextId) {
        const target = e.target as HTMLElement;
        // Don't close if clicking on toolbar or text element
        if (!target.closest('.text-toolbar') && !target.closest('[data-text-id]')) {
          setSelectedTextId(null);
          setSelectedTextToolbarPosition(null);
        }
      }
    };

    if (selectedTextId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedTextId]);

  // Load files dari sessionStorage dan IndexedDB
  useEffect(() => {
    const loadFiles = async () => {
      const sessionId = searchParams.get("session");
      if (!sessionId) {
        router.push("/sign");
        return;
      }

      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-sign-session-${sessionId}`);
        if (!sessionDataStr) {
          router.push("/sign");
          return;
        }

        const sessionData = JSON.parse(sessionDataStr);
        const fileIds: string[] = sessionData.fileIds || [];

        if (fileIds.length === 0) {
          router.push("/sign");
          return;
        }

        const loadedFiles: FileObject[] = [];
        for (const fileId of fileIds) {
          try {
            const fileMetadataStr = sessionStorage.getItem(`pdf-sign-${fileId}`);
            if (!fileMetadataStr) continue;

            const fileMetadata = JSON.parse(fileMetadataStr);
            const arrayBuffer = await indexedDBManager.getFile(fileId);
            const file = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });

            loadedFiles.push({
              id: fileId,
              file,
            });

            // Get total pages and generate thumbnails for each file
            try {
              const pdfjsLib = await import("pdfjs-dist");
              const version = pdfjsLib.version || "5.4.530";
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

              const url = URL.createObjectURL(file);
              const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
              const pdf = await loadingTask.promise;
              setPdfPages((prev) => new Map(prev).set(fileId, pdf.numPages));
              URL.revokeObjectURL(url);
            } catch (error) {
              console.error(`Error loading PDF pages for ${fileId}:`, error);
            }
          } catch (error) {
            console.error(`Error loading file ${fileId}:`, error);
          }
        }

        if (loadedFiles.length === 0) {
          router.push("/sign");
          return;
        }

        setFileObjects(loadedFiles);
        setIsLoading(false);
        
        // Set first file as current file
        if (loadedFiles.length > 0) {
          setCurrentFileId(loadedFiles[0].id);
          setCurrentPageNumber(1);
        }
      } catch (error) {
        console.error("Error loading files:", error);
        router.push("/sign");
      }
    };

    loadFiles();
  }, [searchParams, router]);

  // Generate thumbnails for a file
  const generateThumbnails = async (fileId: string, file: File) => {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const version = pdfjsLib.version || "5.4.530";
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

      const url = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const scale = 0.25; // Small scale for thumbnails
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
          setPageThumbnails((prev) => new Map(prev).set(`${fileId}-${pageNum}`, dataUrl));
        } catch (error) {
          console.warn(`Error generating thumbnail for page ${pageNum}:`, error);
        }
      }

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error generating thumbnails for ${fileId}:`, error);
    }
  };

  // Generate thumbnails when currentFileId changes
  useEffect(() => {
    if (currentFileId && fileObjects.length > 0) {
      const fileObj = fileObjects.find(f => f.id === currentFileId);
      if (fileObj) {
        // Check if thumbnails already exist
        const firstThumbnailKey = `${currentFileId}-1`;
        if (!pageThumbnails.has(firstThumbnailKey)) {
          generateThumbnails(currentFileId, fileObj.file);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileId]);

  // Sync thumbnail dengan halaman yang sedang dilihat - pendekatan sederhana dan stabil
  useEffect(() => {
    const viewer = mainViewerRef.current;
    if (!viewer || !currentFileId) return;

    const syncThumbnail = () => {
      // Gunakan ref untuk mendapatkan nilai terbaru
      const activeFileId = currentFileIdRef.current;
      if (!activeFileId) return;

      // Debug: Cek apakah elemen ditemukan
      const pages = viewer.querySelectorAll(`[id^="page-${activeFileId}-"]`);
      
      // Debug logging (bisa dihapus setelah testing)
      if (pages.length === 0) {
        console.warn(`No pages found with selector: [id^="page-${activeFileId}-"]`);
        return;
      }

      let targetPage: { num: number; visibleHeight: number } | null = null;

      // Cari halaman yang paling banyak terlihat di viewport viewer
      pages.forEach((page) => {
        const pageElement = page as HTMLElement;
        const rect = pageElement.getBoundingClientRect();
        const viewerRect = viewer.getBoundingClientRect();

        // Hitung seberapa banyak halaman masuk ke viewport
        const visibleTop = Math.max(rect.top, viewerRect.top);
        const visibleBottom = Math.min(rect.bottom, viewerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        const currentMaxHeight = targetPage ? targetPage.visibleHeight : 0;
        if (visibleHeight > currentMaxHeight) {
          // Extract page number from ID (format: page-{fileId}-{pageNum})
          const match = pageElement.id.match(/-(\d+)$/);
          if (match) {
            const pageNum = parseInt(match[1], 10);
            targetPage = {
              num: pageNum,
              visibleHeight: visibleHeight
            };
          }
        }
      });

      // Update current page jika berbeda
      if (targetPage !== null) {
        const pageInfo = targetPage as { num: number; visibleHeight: number };
        if (pageInfo.num !== currentPageNumberRef.current) {
          setCurrentPageNumber(pageInfo.num);
          
          // Scroll Thumbnail ke center
          const thumb = thumbnailRefs.current.get(pageInfo.num);
          if (thumb) {
            thumb.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    };

    // Wait a bit for DOM to be ready
    const timeoutId = setTimeout(() => {
      // Initial sync
      syncThumbnail();
      
      // Listen to scroll events
      viewer.addEventListener('scroll', syncThumbnail, { passive: true });
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      viewer.removeEventListener('scroll', syncThumbnail);
    };
  }, [currentFileId]);

  const handleAddFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      alert("Hanya file PDF yang didukung");
      return;
    }

    const sessionId = searchParams.get("session");
    if (!sessionId) return;

    try {
      const newFileIds: string[] = [];
      const newFiles: FileObject[] = [];

      for (const file of pdfFiles) {
        const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
        await indexedDBManager.saveFile(fileId, file);
        newFileIds.push(fileId);

        const fileMetadata = {
          id: fileId,
          name: file.name,
        };
        sessionStorage.setItem(`pdf-sign-${fileId}`, JSON.stringify(fileMetadata));

        const arrayBuffer = await indexedDBManager.getFile(fileId);
        const fileObj = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });
        newFiles.push({
          id: fileId,
          file: fileObj,
        });

        // Get total pages
        try {
          const pdfjsLib = await import("pdfjs-dist");
          const version = pdfjsLib.version || "5.4.530";
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

          const url = URL.createObjectURL(fileObj);
          const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
          const pdf = await loadingTask.promise;
          setPdfPages((prev) => new Map(prev).set(fileId, pdf.numPages));
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error(`Error loading PDF pages:`, error);
        }
      }

      setFileObjects((prev) => [...prev, ...newFiles]);

      // Update session data
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-sign-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = [...sessionData.fileIds, ...newFileIds];
          sessionStorage.setItem(`pdf-sign-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    } catch (error) {
      console.error("Error adding files:", error);
      alert("Error menambahkan file.");
    }
  };

  const handleRemove = async (id: string) => {
    setFileObjects((prev) => prev.filter((o) => o.id !== id));
    
    // Remove signature positions for this file
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      const key = `${id}-*`;
      for (const [mapKey] of newMap.entries()) {
        if (mapKey.startsWith(`${id}-`)) {
          newMap.delete(mapKey);
        }
      }
      return newMap;
    });

    // Remove text positions for this file
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      for (const [mapKey] of newMap.entries()) {
        if (mapKey.startsWith(`${id}-`)) {
          newMap.delete(mapKey);
        }
      }
      return newMap;
    });

    // Remove from pdfPages
    setPdfPages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });

    const sessionId = searchParams.get("session");
    if (sessionId) {
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-sign-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = sessionData.fileIds.filter((fileId: string) => fileId !== id);
          sessionStorage.setItem(`pdf-sign-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    }
  };

  const handleBack = () => {
    router.push("/sign");
  };

  const handleReset = () => {
    setFileObjects([]);
    setSignaturePositions(new Map());
    setTextPositions(new Map());
    setSessionSignature(null);
    setSelectedTextId(null);
    router.push("/sign");
  };

  const handleSaveSignature = (dataUrl: string) => {
    setSessionSignature(dataUrl);
    setShowSignatureCanvas(false);
    
    // Calculate and store signature aspect ratio
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      setSignatureAspectRatio(aspectRatio);
    };
    img.src = dataUrl;
  };

  const handleCreateSignature = () => {
    setShowSignatureCanvas(true);
  };

  const handleEditSignature = () => {
    setShowSignatureCanvas(true);
  };

  const handlePreview = (fileId: string, pageNumber: number) => {
    const fileObj = fileObjects.find((f) => f.id === fileId);
    if (!fileObj) return;

    const url = URL.createObjectURL(fileObj.file);
    setPreviewPdfUrl(url);
    setPreviewFileId(fileId);
    setPreviewPageNumber(pageNumber);
  };

  const handleClosePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
    }
    setPreviewPdfUrl(null);
    setPreviewFileId(null);
    setPreviewPageNumber(null);
  };

  const handleSignatureDrop = (x: number, y: number, pdfPageWidth: number, pdfPageHeight: number) => {
    if (!previewFileId || previewPageNumber === null || !sessionSignature) return;

    // Calculate signature size based on aspect ratio
    // Default: 15% of page width, then calculate height based on signature aspect ratio
    const signatureWidthPoints = pdfPageWidth * 0.15;
    
    // Get aspect ratio (either from state or calculate from image)
    const calculateAspectRatio = (): number => {
      if (signatureAspectRatio) {
        return signatureAspectRatio;
      }
      // Fallback: calculate from image synchronously if possible, or use default
      // Default canvas aspect ratio is 800/300 = 2.67
      return 800 / 300;
    };

    const aspectRatio = calculateAspectRatio();
    const signatureHeightPoints = signatureWidthPoints / aspectRatio;

    // If aspect ratio not stored yet, calculate it now
    if (!signatureAspectRatio && sessionSignature) {
      const img = new Image();
      img.onload = () => {
        const calculatedAspectRatio = img.width / img.height;
        setSignatureAspectRatio(calculatedAspectRatio);
      };
      img.src = sessionSignature;
    }

    const positionId = `${previewFileId}-${previewPageNumber}-${Date.now()}`;
    const newPosition: SignaturePosition = {
      id: positionId,
      fileId: previewFileId,
      pageNumber: previewPageNumber,
      x: Math.max(0, Math.min(pdfPageWidth - signatureWidthPoints, x)),
      y: Math.max(0, Math.min(pdfPageHeight - signatureHeightPoints, y)),
      width: signatureWidthPoints,
      height: signatureHeightPoints,
      pdfPageWidth,
      pdfPageHeight,
    };

    const key = `${previewFileId}-${previewPageNumber}`;
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) || [];
      newMap.set(key, [...existing, newPosition]);
      return newMap;
    });
  };

  // Handle drag over untuk preview signature secara real-time
  const handleDragOver = (
    fileId: string,
    pageNumber: number,
    event: React.DragEvent,
    pdfOriginalSize: { width: number; height: number },
    scaleFactor: number
  ) => {
    // Handler ini dipanggil saat drag over untuk update preview
    // Tidak perlu melakukan apa-apa di sini karena preview sudah di-handle di PagePreviewItem
  };

  // Handle direct drop to thumbnail (with PDF coordinate conversion)
  const handleThumbnailDrop = (
    fileId: string, 
    pageNumber: number, 
    event: React.DragEvent,
    pdfOriginalSize: { width: number; height: number },
    scaleFactor: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!sessionSignature || pdfOriginalSize.width === 0 || scaleFactor === 0) return;

    // Get drop position relative to canvas
    const container = event.currentTarget.closest('.relative.group') as HTMLElement;
    const canvas = container?.querySelector('canvas') as HTMLCanvasElement;
    
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate position relative to canvas (browser pixels) - EXACT same as preview
    const dropXPixels = event.clientX - canvasRect.left;
    const dropYPixels = event.clientY - canvasRect.top;
    
    // Convert browser pixels to PDF points - EXACT same as preview
    const dropXPoints = dropXPixels / scaleFactor;
    const dropYPoints = dropYPixels / scaleFactor;

    // Calculate signature size based on aspect ratio - EXACT same as preview
    // Default: 15% of page width, then calculate height based on signature aspect ratio
    let signatureWidthPoints = pdfOriginalSize.width * 0.15;
    let signatureHeightPoints: number;
    
    if (signatureAspectRatio) {
      // Use stored aspect ratio - same as preview
      signatureHeightPoints = signatureWidthPoints / signatureAspectRatio;
    } else {
      // Fallback: use same default as preview (800/300 aspect ratio)
      const defaultAspectRatio = 800 / 300;
      signatureHeightPoints = signatureWidthPoints / defaultAspectRatio;
    }

    // Clamp to ensure signature fits within PDF bounds - same logic as preview
    const clampedX = Math.max(0, Math.min(pdfOriginalSize.width - signatureWidthPoints, dropXPoints));
    const clampedY = Math.max(0, Math.min(pdfOriginalSize.height - signatureHeightPoints, dropYPoints));

    const positionId = `${fileId}-${pageNumber}-${Date.now()}`;
    const newPosition: SignaturePosition = {
      id: positionId,
      fileId,
      pageNumber,
      x: clampedX,
      y: clampedY, // Already from top, no adjustment needed
      width: signatureWidthPoints,
      height: signatureHeightPoints,
      pdfPageWidth: pdfOriginalSize.width,
      pdfPageHeight: pdfOriginalSize.height,
    };

    const key = `${fileId}-${pageNumber}`;
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) || [];
      newMap.set(key, [...existing, newPosition]);
      return newMap;
    });
  };

  const handleSignatureMove = (id: string, x: number, y: number) => {
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const updated = positions.map((pos) =>
          pos.id === id ? { ...pos, x, y } : pos
        );
        if (updated.some((p) => p.id === id)) {
          newMap.set(key, updated);
          break;
        }
      }
      return newMap;
    });
  };

  const handleSignatureRemove = (id: string) => {
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const filtered = positions.filter((pos) => pos.id !== id);
        if (filtered.length === 0) {
          newMap.delete(key);
        } else {
          newMap.set(key, filtered);
        }
      }
      return newMap;
    });
  };

  const handleSignatureResize = (id: string, width: number, height: number) => {
    setSignaturePositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const updated = positions.map((pos) =>
          pos.id === id ? { ...pos, width, height } : pos
        );
        if (updated.some((p) => p.id === id)) {
          newMap.set(key, updated);
          break;
        }
      }
      return newMap;
    });
  };

  // Text handlers
  const handleTextMove = (id: string, x: number, y: number) => {
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const updated = positions.map((pos) =>
          pos.id === id ? { ...pos, x, y } : pos
        );
        if (updated.some((p) => p.id === id)) {
          newMap.set(key, updated);
          break;
        }
      }
      return newMap;
    });
  };

  const handleTextResize = (id: string, fontSize: number) => {
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const updated = positions.map((pos) =>
          pos.id === id ? { ...pos, fontSize } : pos
        );
        if (updated.some((p) => p.id === id)) {
          newMap.set(key, updated);
          break;
        }
      }
      return newMap;
    });
  };

  const handleTextRemove = (id: string) => {
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      for (const [key, positions] of newMap.entries()) {
        const filtered = positions.filter((pos) => pos.id !== id);
        if (filtered.length === 0) {
          newMap.delete(key);
        } else {
          newMap.set(key, filtered);
        }
      }
      return newMap;
    });
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  const handleTextClick = (id: string, position: { x: number; y: number }) => {
    setSelectedTextId(id);
    setSelectedTextToolbarPosition(position);
    setShowTextToolbar(true); // Tampilkan toolbar saat teks diklik
  };

  const handleTextUpdate = (updated: TextPosition) => {
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      const key = `${updated.fileId}-${updated.pageNumber}`;
      const existing = newMap.get(key) || [];
      const updatedList = existing.map((pos) =>
        pos.id === updated.id ? updated : pos
      );
      newMap.set(key, updatedList);
      return newMap;
    });
  };

  // Handle keyboard arrow keys untuk memindahkan teks dan Ctrl+D untuk duplicate
  useEffect(() => {
    if (!selectedTextId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Hanya handle jika tidak sedang mengetik di input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ctrl+D atau Cmd+D untuk duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleTextDuplicate(selectedTextId);
        return;
      }

      // Cari teks yang dipilih
      const selectedText = Array.from(textPositions.values())
        .flat()
        .find((t) => t.id === selectedTextId);

      if (!selectedText) return;

      // Arrow keys untuk memindahkan teks
      const stepSize = 1; // Langkah pergerakan dalam PDF points (dikurangi dari 5 menjadi 1)
      let newX = selectedText.x;
      let newY = selectedText.y;
      let shouldMove = false;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          newY = Math.max(0, selectedText.y - stepSize);
          shouldMove = true;
          break;
        case "ArrowDown":
          e.preventDefault();
          newY = Math.min(selectedText.pdfPageHeight, selectedText.y + stepSize);
          shouldMove = true;
          break;
        case "ArrowLeft":
          e.preventDefault();
          newX = Math.max(0, selectedText.x - stepSize);
          shouldMove = true;
          break;
        case "ArrowRight":
          e.preventDefault();
          newX = Math.min(selectedText.pdfPageWidth, selectedText.x + stepSize);
          shouldMove = true;
          break;
        default:
          return;
      }

      if (shouldMove) {
        // Update posisi teks
        handleTextMove(selectedTextId, newX, newY);
        
        // Sembunyikan toolbar saat menggeser dengan arrow keys agar tidak menutupi teks
        // Tapi tetap biarkan selectedTextId agar arrow keys tetap berfungsi
        setShowTextToolbar(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTextId, textPositions]);

  // Fungsi untuk duplicate teks dengan semua settingannya
  const handleTextDuplicate = (textId: string) => {
    const selectedText = Array.from(textPositions.values())
      .flat()
      .find((t) => t.id === textId);

    if (!selectedText) return;

    // Buat duplikat dengan offset kecil (10 PDF points)
    const duplicate: TextPosition = {
      ...selectedText,
      id: `${selectedText.fileId}-${selectedText.pageNumber}-${Date.now()}`,
      x: selectedText.x + 10, // Offset sedikit ke kanan
      y: selectedText.y + 10, // Offset sedikit ke bawah
    };

    // Tambahkan duplikat ke posisi yang sama
    setTextPositions((prev) => {
      const newMap = new Map(prev);
      const key = `${duplicate.fileId}-${duplicate.pageNumber}`;
      const existing = newMap.get(key) || [];
      newMap.set(key, [...existing, duplicate]);
      return newMap;
    });

    // Select teks yang baru di-duplicate
    setTimeout(() => {
      setSelectedTextId(duplicate.id);
      setShowTextToolbar(true); // Tampilkan toolbar untuk teks yang baru di-duplicate
      // Update toolbar position (akan di-update saat teks di-render)
      const textElement = document.querySelector(`[data-text-id="${duplicate.id}"]`);
      if (textElement) {
        const rect = textElement.getBoundingClientRect();
        setSelectedTextToolbarPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    }, 100);
  };

  const handleSignPDF = async () => {
    const hasAnyText = Array.from(textPositions.values()).some(
      (positions) => positions && positions.length > 0
    );

    if (fileObjects.length === 0 || (!sessionSignature && !hasAnyText)) {
      alert("Silakan tambahkan tanda tangan atau teks terlebih dahulu.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const signedPdfs: { file: File; fileName: string }[] = [];

      for (let i = 0; i < fileObjects.length; i++) {
        const fileObj = fileObjects[i];
        setProgress(Math.round(((i + 1) / fileObjects.length) * 50));

        // Load PDF
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        // Load signature image (jika ada)
        let signatureImage: any = null;
        let signatureAspectRatioLocal: number | null = null;

        if (sessionSignature) {
          signatureImage = await pdfDoc.embedPng(sessionSignature);
          // Get original signature dimensions to calculate aspect ratio
          signatureAspectRatioLocal =
            signatureImage.width / signatureImage.height;
        }

        // Get all signature positions for this file
        const allPositions: SignaturePosition[] = [];
        for (const [key, positions] of signaturePositions.entries()) {
          if (key.startsWith(`${fileObj.id}-`) && Array.isArray(positions)) {
            allPositions.push(...positions);
          }
        }

        // Add signature to each position (jika ada signature)
        if (signatureImage && signatureAspectRatioLocal) {
          for (const position of allPositions) {
            const page = pdfDoc.getPage(position.pageNumber - 1);
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Positions are already in PDF points, use them directly
            // But we need to handle Y-axis: PDF starts from bottom-left, our coordinates are top-left
            // So: pdfY = pageHeight - position.y - position.height
            const pdfX = position.x;
            
            // Calculate actual width and height maintaining signature aspect ratio
            // Use the stored width/height as preferred size, but adjust to maintain aspect ratio
            let finalWidth = position.width;
            let finalHeight = position.height;
            
            // Check if current dimensions match signature aspect ratio
            const positionAspectRatio = position.width / position.height;
            
            if (Math.abs(positionAspectRatio - signatureAspectRatioLocal) > 0.01) {
              // Aspect ratios don't match, adjust to maintain signature aspect ratio
              // Use width as primary dimension and calculate height
              finalHeight = finalWidth / signatureAspectRatioLocal;
              
              // If calculated height exceeds position height, use height as primary instead
              if (finalHeight > position.height) {
                finalHeight = position.height;
                finalWidth = finalHeight * signatureAspectRatioLocal;
              }
            }
            
            const pdfY = pageHeight - position.y - finalHeight;

            page.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: finalWidth,
              height: finalHeight,
            });
          }
        }

        // Add text to each position
        const allTextPositions: TextPosition[] = [];
        for (const [key, positions] of textPositions.entries()) {
          if (key.startsWith(`${fileObj.id}-`) && Array.isArray(positions)) {
            allTextPositions.push(...positions);
          }
        }

        // Function to rasterize text to canvas with DPI and blur
        const rasterizeText = async (
          text: string,
          fontSize: number,
          fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier',
          color: string,
          opacity: number,
          dpi: number = 300,
          blur: number = 0,
          padding: number = 20
        ): Promise<string> => {
          // Create offscreen canvas for rasterization
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          // Calculate canvas size based on DPI
          // PDF points to pixels: 1 point = 1/72 inch
          // At specified DPI: pixels = (points / 72) * DPI
          const scaleFactor = dpi / 72;
          const canvasFontSize = fontSize * scaleFactor;
          
          // Map font family to CSS font (use same mapping as editor)
          const fontFamilyMap: Record<string, string> = {
            'Helvetica': 'Arial, Helvetica, sans-serif',
            'TimesRoman': 'Times, "Times New Roman", serif',
            'Courier': 'Courier, monospace',
          };

          // Set font
          ctx.font = `${canvasFontSize}px ${fontFamilyMap[fontFamily] || 'Arial'}`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';

          // Measure text with precision
          const metrics = ctx.measureText(text);
          const textWidth = metrics.width;
          const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
          
          // Use fixed padding (20) for stability across different resolutions
          // Canvas size: text dimensions + padding on all sides
          // Use actualHeight for precision, but ensure minimum height for line-height consistency
          const minTextHeight = canvasFontSize; // Minimum height based on font size
          const textHeight = Math.max(actualHeight, minTextHeight);
          canvas.width = Math.ceil(textWidth + (padding * 2));
          canvas.height = Math.ceil(textHeight + (padding * 2));

          // Clear canvas with transparent background
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Apply blur filter if needed
          if (blur > 0) {
            ctx.filter = `blur(${blur}px)`;
          }

          // Set color and opacity
          const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
              ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity / 100})`
              : `rgba(0, 0, 0, ${opacity / 100})`;
          };

          ctx.fillStyle = hexToRgb(color);
          ctx.font = `${canvasFontSize}px ${fontFamilyMap[fontFamily] || 'Arial'}`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';

          // Draw text with padding offset (top-left corner at padding, padding)
          ctx.fillText(text, padding, padding);

          // Reset filter
          ctx.filter = 'none';

          // Convert to data URL
          return canvas.toDataURL('image/png');
        };

        for (const textPos of allTextPositions) {
          const page = pdfDoc.getPage(textPos.pageNumber - 1);
          const { width: pageWidth, height: pageHeight } = page.getSize();
        
          // Use DPI from textPosition, default to 300 for print quality
          const renderDpi = textPos.dpi || 300;
          const pdfPointsPerInch = 72;
          const scaleFactor = pdfPointsPerInch / renderDpi; // Convert from canvas pixels to PDF points
        
          // 1. Rasterize with known fixed padding
          const canvasPadding = 20; // Fixed padding for stability across resolutions
          const textImageDataUrl = await rasterizeText(
            textPos.text, 
            textPos.fontSize, 
            textPos.fontFamily, 
            textPos.color, 
            textPos.opacity, 
            renderDpi, 
            textPos.blur || 0,
            canvasPadding // Pass padding to function
          );
          const base64Data = textImageDataUrl.split(',')[1];
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const textImage = await pdfDoc.embedPng(imageBytes);
        
          // 2. Calculate image size in PDF Points
          const imageWidthInPoints = textImage.width * scaleFactor;
          const imageHeightInPoints = textImage.height * scaleFactor;
          const paddingInPoints = canvasPadding * scaleFactor;
        
          /**
           * 3. PIXEL-PERFECT COORDINATE LOGIC
           * x, y from state should already be in PDF Points (converted from browser pixels using scaleFactor).
           * 
           * LOGIKA PERBAIKAN:
           * textPos.y = Jarak dari TOP halaman ke TOP teks di browser (dalam PDF Points).
           * Kita ingin TOP teks di PDF berada tepat di textPos.y.
           * 
           * PDF uses bottom-left coordinate system (Y=0 at bottom)
           * Browser uses top-left coordinate system (Y=0 at top)
           * 
           * Karena teks di dalam image ada di bawah padding (padding pixels dari top image),
           * maka:
           * - Titik TOP Image = (pageHeight - textPos.y) + paddingInPoints
           * - Titik BOTTOM Image (pdfY) = Titik TOP Image - Total Tinggi Image
           */
          // Posisi X: Geser ke kiri sebesar padding agar teks mulai tepat di x
          const pdfX = textPos.x - paddingInPoints;
          
          // Posisi Y: 
          // pageHeight - textPos.y = Posisi TOP teks dari bawah (sistem PDF)
          // Karena teks di dalam image ada di bawah padding, maka:
          // Titik TOP Image = (pageHeight - textPos.y) + paddingInPoints
          // Titik BOTTOM Image (pdfY) = Titik TOP Image - Total Tinggi Image
          const pdfY = (pageHeight - textPos.y) + paddingInPoints - imageHeightInPoints;
        
          // Draw image with padding offset so text top is at textPos.y
          // Note: Do not round coordinates too early to maintain precision
          page.drawImage(textImage, {
            x: pdfX,
            y: pdfY, 
            width: imageWidthInPoints,
            height: imageHeightInPoints,
          });
        }

        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        const signedFile = new File([blob as Blob], fileObj.file.name.replace(".pdf", "_signed.pdf"), {
          type: "application/pdf",
        });

        signedPdfs.push({ file: signedFile, fileName: signedFile.name });
        setProgress(Math.round(50 + ((i + 1) / fileObjects.length) * 50));
      }

      if (signedPdfs.length === 0) {
        alert("Tidak ada file yang diproses.");
        setIsProcessing(false);
        return;
      }

      // Create ZIP if multiple files, or single download
      if (signedPdfs.length === 1) {
        const url = URL.createObjectURL(signedPdfs[0].file);
        setDownloadUrl(url);
      } else {
        // Merge multiple files
        const mergedPdf = await PDFDocument.create();
        for (const signedPdf of signedPdfs) {
          const arrayBuffer = await signedPdf.file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
        }
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      }

      setProgress(100);
    } catch (error) {
      console.error("Error signing PDF:", error);
      alert("Error menandatangani PDF. Pastikan semua file valid.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" size={32} />
          <p className="text-sm text-slate-600 dark:text-slate-400">Memuat file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FDFDFF] dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign PDF Editor</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fileObjects.length} file
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File List */}
        <div
          className="flex-1 overflow-y-auto p-4 relative"
          style={{ overscrollBehavior: "contain" }}
          onDragOver={(e) => {
            // Hanya aktifkan drop zone untuk file PDF (yang memiliki type "Files")
            // Signature drag hanya memiliki "text/plain", bukan "Files"
            const hasFiles = e.dataTransfer.types.includes("Files") || 
                            (e.dataTransfer.files && e.dataTransfer.files.length > 0);
            
            if (!hasFiles) {
              // Ini kemungkinan signature drag, jangan aktifkan drop zone file
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging && !isProcessing && !downloadUrl) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(e) => {
            // Hanya handle jika ada files
            const hasFiles = e.dataTransfer.types.includes("Files") || 
                            (e.dataTransfer.files && e.dataTransfer.files.length > 0);
            
            if (!hasFiles) {
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            // Hanya handle drop file, bukan signature
            const files = Array.from(e.dataTransfer.files);
            
            // Jika tidak ada files, kemungkinan ini signature drop
            if (files.length === 0) {
              // Biarkan signature drop di-handle oleh PagePreviewItem
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (isProcessing || downloadUrl) return;
            
            if (files.length > 0) {
              handleAddFiles(files);
            }
          }}
        >
          {/* Drag and Drop Overlay */}
          {isDragging && !isProcessing && !downloadUrl && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 dark:bg-blue-900/30 backdrop-blur-sm border-4 border-dashed border-blue-500 dark:border-blue-400 rounded-xl flex items-center justify-center">
              <div className="text-center"> 
                <div className="p-6 rounded-full bg-blue-100 dark:bg-blue-900/40 mb-4 mx-auto w-fit">
                  <Plus size={48} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  Lepaskan file di sini untuk menambahkan
                </p>
              </div>
            </div>
          )}

          {!downloadUrl && (
            <>
              {fileObjects.length > 0 && currentFileId ? (
                <div className="flex gap-4 h-full">
                  {/* Left Sidebar - Thumbnails */}
                  <div 
                    ref={thumbnailContainerRef}
                    className="w-48 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto"
                  >
                    <div className="mb-4">
                      <select
                        value={currentFileId}
                        onChange={(e) => {
                          const fileId = e.target.value;
                          setCurrentFileId(fileId);
                          setCurrentPageNumber(1);
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        {fileObjects.map((fileObj) => (
                          <option key={fileObj.id} value={fileObj.id}>
                            {fileObj.file.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-2">
                      {pdfPages.get(currentFileId) || 0} halaman
                    </div>
                    
                    <div className="space-y-2">
                      {Array.from({ length: pdfPages.get(currentFileId) || 0 }, (_, i) => i + 1).map((pageNum) => {
                        const thumbnailKey = `${currentFileId}-${pageNum}`;
                        const thumbnail = pageThumbnails.get(thumbnailKey);
                        const key = `${currentFileId}-${pageNum}`;
                        const positions = signaturePositions.get(key) || [];
                        const hasSignature = positions.length > 0;

                        return (
                          <div
                            key={pageNum}
                            ref={(el) => {
                              if (el) {
                                thumbnailRefs.current.set(pageNum, el);
                              } else {
                                thumbnailRefs.current.delete(pageNum);
                              }
                            }}
                            onClick={() => {
                              setCurrentPageNumber(pageNum);
                              // Scroll to page in main viewer
                              const pageElement = document.getElementById(`page-${currentFileId}-${pageNum}`);
                              if (pageElement) {
                                pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className={`relative cursor-pointer rounded border-2 transition-all ${
                              currentPageNumber === pageNum
                                ? "border-blue-500 dark:border-blue-400 shadow-md"
                                : "border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600"
                            }`}
                          >
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={`Halaman ${pageNum}`}
                                className="w-full h-auto"
                              />
                            ) : (
                              <div className="w-full aspect-[3/4] bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <Loader2 className="animate-spin text-slate-400" size={20} />
                              </div>
                            )}
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-xs font-bold rounded">
                              {pageNum}
                            </div>
                            {hasSignature && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Viewer Area - All Pages Scrollable */}
                  <div 
                    ref={mainViewerRef}
                    className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900"
                  >
                    {(() => {
                      const currentFile = fileObjects.find(f => f.id === currentFileId);
                      if (!currentFile) return null;
                      
                      const totalPages = pdfPages.get(currentFileId) || 0;

                      return (
                        <div className="p-4 space-y-4">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                            const key = `${currentFileId}-${pageNum}`;
                            const positions = signaturePositions.get(key) || [];

                            return (
                              <div
                                key={pageNum}
                                id={`page-${currentFileId}-${pageNum}`}
                                className="flex justify-center"
                              >
                                <PagePreviewItem
                                  fileId={currentFileId}
                                  pageNum={pageNum}
                                  pdfFile={currentFile.file}
                                  isLoading={false}
                                  positions={positions}
                                  textPositions={textPositions.get(key) || []}
                                  sessionSignature={sessionSignature}
                                  onDrop={(e, pdfSize, scale) => handleThumbnailDrop(currentFileId, pageNum, e, pdfSize, scale)}
                                  onDragOver={(e, pdfSize, scale) => handleDragOver(currentFileId, pageNum, e, pdfSize, scale)}
                                  onSignatureMove={handleSignatureMove}
                                  onSignatureResize={handleSignatureResize}
                                  onSignatureRemove={handleSignatureRemove}
                                  onTextMove={handleTextMove}
                                  onTextResize={handleTextResize}
                                  onTextRemove={handleTextRemove}
                                  onTextClick={handleTextClick}
                                  signatureAspectRatio={signatureAspectRatio}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">Belum ada file yang diupload</p>
                </div>
              )}

              {isProcessing && (
                <div className="mb-4">
                  <ProgressBar progress={progress} />
                </div>
              )}
            </>
          )}

          {downloadUrl && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-pink-50 dark:to-pink-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                  Berhasil menandatangani PDF
                </p>
              </div>
              <DownloadSection
                downloadUrl={downloadUrl}
                fileName={downloadFileName}
                onFileNameChange={setDownloadFileName}
                onReset={handleReset}
              />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        {!downloadUrl && (
        <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Signature Display */}
            {sessionSignature && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">
                    Tanda Tangan Anda
                  </h3>
                  <button
                    onClick={handleEditSignature}
                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
                    title="Edit Tanda Tangan"
                  >
                    <PenTool size={14} className="text-blue-600 dark:text-blue-400" />
                  </button>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border-2 border-dashed border-blue-300 dark:border-blue-700">
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "signature");
                      
                      // Create invisible drag image (1x1 transparent pixel)
                      const dragImage = document.createElement("div");
                      dragImage.style.position = "absolute";
                      dragImage.style.top = "-1000px";
                      dragImage.style.left = "-1000px";
                      dragImage.style.width = "1px";
                      dragImage.style.height = "1px";
                      dragImage.style.opacity = "0";
                      dragImage.style.pointerEvents = "none";
                      document.body.appendChild(dragImage);
                      
                      // Set invisible drag image
                      e.dataTransfer.setDragImage(dragImage, 0, 0);
                      
                      // Clean up after drag starts
                      setTimeout(() => {
                        if (document.body.contains(dragImage)) {
                          document.body.removeChild(dragImage);
                        }
                      }, 0);
                      
                      // Stop propagation agar tidak terdeteksi sebagai file drag
                      e.stopPropagation();
                    }}
                    onDrag={(e) => {
                      // Stop propagation selama drag
                      e.stopPropagation();
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <img
                      src={sessionSignature}
                      alt="Signature"
                      className="w-full h-auto max-h-32 object-contain pointer-events-none"
                      draggable={false}
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center">
                  Seret ke halaman untuk menambahkan
                </p>
              </div>
            )}

            {!sessionSignature && (
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 text-center mb-3">
                  Belum ada tanda tangan
                </p>
                <button
                  onClick={handleCreateSignature}
                  className="w-full py-3 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <PenTool size={18} />
                  <span>Buat Tanda Tangan</span>
                </button>
              </div>
            )}

            {/* Add Text Button */}
            {fileObjects.length > 0 && currentFileId && (
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <button
                  onClick={() => {
                    // Add text to current page
                    if (!currentFileId || !currentPageNumber) return;
                    const key = `${currentFileId}-${currentPageNumber}`;
                    const currentFile = fileObjects.find(f => f.id === currentFileId);
                    if (!currentFile) return;

                    // Get PDF page size and calculate position based on viewport
                    const getPdfPageSize = async () => {
                      try {
                        const pdfjsLib = await import("pdfjs-dist");
                        const version = pdfjsLib.version || "5.4.530";
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

                        const url = URL.createObjectURL(currentFile.file);
                        const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
                        const pdf = await loadingTask.promise;
                        // pdf.getPage menggunakan index 1-based, jadi langsung gunakan currentPageNumber
                        const totalPages = pdf.numPages || 0;
                        const safePageNumber = Math.min(
                          Math.max(currentPageNumber, 1),
                          totalPages || 1
                        );
                        const page = await pdf.getPage(safePageNumber);
                        const viewport = page.getViewport({ scale: 1 });
                        URL.revokeObjectURL(url);

                        // Calculate position based on current viewport (visible area)
                        let textX = viewport.width * 0.5; // Default: center horizontally
                        let textY = viewport.height * 0.15; // Default: 15% from top

                        // Try to get the current page element and calculate position from viewport
                        const pageElement = document.getElementById(`page-${currentFileId}-${currentPageNumber}`);
                        if (pageElement && mainViewerRef.current) {
                          const viewerRect = mainViewerRef.current.getBoundingClientRect();
                          const pageRect = pageElement.getBoundingClientRect();
                          
                          // Check if page is visible in viewport
                          const isPageVisible = (
                            pageRect.top < viewerRect.bottom &&
                            pageRect.bottom > viewerRect.top
                          );

                          if (isPageVisible) {
                            // Find the canvas element to get scaleFactor and position
                            const canvas = pageElement.querySelector('canvas');
                            if (canvas) {
                              const canvasRect = canvas.getBoundingClientRect();
                              // Calculate scaleFactor: canvas pixels / PDF points
                              const scaleFactor = canvasRect.width / viewport.width;
                              
                              // Calculate visible area of canvas relative to viewer
                              const canvasVisibleTop = Math.max(0, viewerRect.top - canvasRect.top);
                              const canvasVisibleBottom = Math.min(canvasRect.height, viewerRect.bottom - canvasRect.top);
                              const canvasVisibleHeight = canvasVisibleBottom - canvasVisibleTop;
                              
                              // Place text in the middle of visible canvas area (vertically)
                              const visibleCenterY = canvasVisibleTop + (canvasVisibleHeight / 2);
                              
                              // Convert visible center position to PDF points
                              // visibleCenterY is in browser pixels relative to canvas top
                              textY = visibleCenterY / scaleFactor;
                              
                              // Ensure text is within page bounds
                              textY = Math.max(50, Math.min(textY, viewport.height - 50));
                            }
                          }
                        }

                        const textId = `${currentFileId}-${currentPageNumber}-${Date.now()}`;
                        // CRITICAL: Store coordinates in PDF Points (not screen pixels)
                        // viewport.width and viewport.height from getViewport({ scale: 1 }) are already in PDF Points
                        const newText: TextPosition = {
                          id: textId,
                          fileId: currentFileId,
                          pageNumber: currentPageNumber,
                          // Place text at visible viewport center
                          x: textX, // center horizontally (PDF Points)
                          y: textY, // position based on visible viewport (PDF Points)
                          text: "Teks Baru",
                          fontSize: 18, // PDF Points
                          color: "#000000",
                          opacity: 100,
                          fontFamily: "TimesRoman",
                          pdfPageWidth: viewport.width, // PDF Points
                          pdfPageHeight: viewport.height, // PDF Points
                          dpi: 300, // Use 300 DPI for consistency with handleSignPDF
                          blur: 0.3,
                        };

                        setTextPositions((prev) => {
                          const newMap = new Map(prev);
                          const existing = newMap.get(key) || [];
                          newMap.set(key, [...existing, newText]);
                          return newMap;
                        });
                        setSelectedTextId(textId);
                        
                        // Scroll to the text position after a short delay to ensure DOM is updated
                        setTimeout(() => {
                          const pageElement = document.getElementById(`page-${currentFileId}-${currentPageNumber}`);
                          if (pageElement && mainViewerRef.current) {
                            // Get canvas to calculate scaleFactor
                            const canvas = pageElement.querySelector('canvas');
                            if (canvas) {
                              const canvasRect = canvas.getBoundingClientRect();
                              const scaleFactor = canvasRect.width / viewport.width;
                              
                              // Convert textY (PDF points) to browser pixels
                              const textYInPixels = textY * scaleFactor;
                              
                              // Get page element position relative to viewer
                              const pageRect = pageElement.getBoundingClientRect();
                              const viewerRect = mainViewerRef.current.getBoundingClientRect();
                              
                              // Calculate absolute position of text relative to viewer
                              const textAbsoluteY = pageRect.top - viewerRect.top + 
                                                   (canvasRect.top - pageRect.top) + 
                                                   textYInPixels;
                              
                              // Calculate scroll position to center the text in viewport
                              const scrollY = mainViewerRef.current.scrollTop + 
                                            textAbsoluteY - 
                                            (viewerRect.height / 2);
                              
                              mainViewerRef.current.scrollTo({
                                top: Math.max(0, scrollY),
                                behavior: 'smooth'
                              });
                            }
                          }
                        }, 150);
                      } catch (error) {
                        console.error("Error adding text:", error);
                      }
                    };
                    getPdfPageSize();
                  }}
                  className="w-full py-3 bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <Type size={18} />
                  <span>Tambah Teks</span>
                </button>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
                Cara Menggunakan
              </h3>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Buat atau upload tanda tangan Anda</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Seret tanda tangan dari sidebar langsung ke thumbnail halaman yang ingin ditandatangani</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Klik thumbnail untuk membuka preview besar dan mengatur posisi lebih detail</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Atur posisi dengan drag tanda tangan di preview besar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">5.</span>
                  <span>Klik "Tandatangani PDF" untuk menyimpan</span>
                </li>
              </ul>
            </div>

        {!downloadUrl && (
              <div className="pt-4">
                <button
                  onClick={handleSignPDF}
                  disabled={
                    isProcessing ||
                    fileObjects.length === 0 ||
                    (!sessionSignature &&
                      !Array.from(textPositions.values()).some(
                        (positions) => positions && positions.length > 0
                      ))
                  }
                  className="w-full py-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <PenTool size={20} />
                      <span>Tandatangani PDF</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Signature Canvas Modal */}
      {showSignatureCanvas && (
        <SignaturePad
          onSave={handleSaveSignature}
          onSaveDirect={handleSaveSignature} // Save langsung dari ImageEditor
          onClose={() => {
            setShowSignatureCanvas(false);
          }}
        />
      )}

      {/* Preview Modal with Drag & Drop */}
      {previewPdfUrl && previewFileId && previewPageNumber && (
        <SignaturePreview
          pdfUrl={previewPdfUrl}
          pageNumber={previewPageNumber}
          signatureDataUrl={sessionSignature}
          signaturePositions={signaturePositions.get(`${previewFileId}-${previewPageNumber}`) || []}
          onSignatureDrop={handleSignatureDrop}
          onSignatureMove={handleSignatureMove}
          onSignatureResize={handleSignatureResize}
          onSignatureRemove={handleSignatureRemove}
          onClose={handleClosePreview}
        />
      )}

      {/* Text Toolbar */}
      {selectedTextId && selectedTextToolbarPosition && showTextToolbar && (() => {
        const selectedText = Array.from(textPositions.values())
          .flat()
          .find((t) => t.id === selectedTextId);
        
        if (!selectedText) {
          setSelectedTextId(null);
          setSelectedTextToolbarPosition(null);
          setShowTextToolbar(false);
          return null;
        }

        return (
          <TextToolbar
            textPosition={selectedText}
            onUpdate={handleTextUpdate}
            onClose={() => {
              setSelectedTextId(null);
              setSelectedTextToolbarPosition(null);
              setShowTextToolbar(false);
            }}
            onDelete={() => {
              handleTextRemove(selectedTextId);
              setSelectedTextId(null);
              setSelectedTextToolbarPosition(null);
              setShowTextToolbar(false);
            }}
            onDuplicate={() => {
              handleTextDuplicate(selectedTextId);
            }}
            position={selectedTextToolbarPosition}
          />
        );
      })()}
    </div>
  );
}

export default function SignEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <p className="text-slate-600 dark:text-slate-400">Memuat editor...</p>
          </div>
        </div>
      }
    >
      <SignEditorContent />
    </Suspense>
  );
}
