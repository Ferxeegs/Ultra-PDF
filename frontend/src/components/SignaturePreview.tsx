"use client";

import { useEffect, useRef, useState } from "react";
import { X, GripVertical, Maximize2 } from "lucide-react";

interface SignaturePreviewProps {
  pdfUrl: string;
  pageNumber: number;
  signatureDataUrl: string | null;
  signaturePositions: Array<{ id: string; x: number; y: number; width: number; height: number; pdfPageWidth?: number; pdfPageHeight?: number }>;
  onSignatureDrop: (x: number, y: number, pdfPageWidth: number, pdfPageHeight: number) => void;
  onSignatureMove: (id: string, x: number, y: number) => void;
  onSignatureResize: (id: string, width: number, height: number) => void;
  onSignatureRemove: (id: string) => void;
  onClose: () => void;
}

export default function SignaturePreview({
  pdfUrl,
  pageNumber,
  signatureDataUrl,
  signaturePositions,
  onSignatureDrop,
  onSignatureMove,
  onSignatureResize,
  onSignatureRemove,
  onClose,
}: SignaturePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [draggedSignatureId, setDraggedSignatureId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizingSignatureId, setResizingSignatureId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 }); // Browser viewport size (pixels)
  const [pdfOriginalSize, setPdfOriginalSize] = useState({ width: 0, height: 0 }); // PDF original size (points)
  const [scaleFactor, setScaleFactor] = useState(1); // Scale between PDF and browser view
  const [isDraggingFromSidebar, setIsDraggingFromSidebar] = useState(false);
  const interactionLayerRef = useRef<HTMLDivElement>(null);

  // Load PDF page
  useEffect(() => {
    const loadPdfPage = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, verbosity: 0 });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        setPdfPage(page);

        // Get original PDF page dimensions in Points
        const originalViewport = page.getViewport({ scale: 1 });
        const pdfWidth = originalViewport.width; // Original PDF width in points
        const pdfHeight = originalViewport.height; // Original PDF height in points
        setPdfOriginalSize({ width: pdfWidth, height: pdfHeight });

        // Calculate scale for display (1.5x for preview)
        const viewport = page.getViewport({ scale: 1.5 });
        setPageSize({ width: viewport.width, height: viewport.height });
        
        // Calculate scale factor: browser pixels to PDF points
        const calculatedScaleFactor = viewport.width / pdfWidth;
        setScaleFactor(calculatedScaleFactor);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;
      } catch (error) {
        console.error("Error loading PDF page:", error);
      }
    };

    if (pdfUrl) {
      loadPdfPage();
    }
  }, [pdfUrl, pageNumber]);

  const handleSignatureDragStart = (e: React.MouseEvent, id: string, pdfX: number, pdfY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSignature(true);
    setDraggedSignatureId(id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && scaleFactor > 0) {
      // Convert PDF points to browser pixels
      const actualX = pdfX * scaleFactor;
      const actualY = pdfY * scaleFactor;
      setDragOffset({
        x: e.clientX - rect.left - actualX,
        y: e.clientY - rect.top - actualY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing && resizingSignatureId && containerRef.current && scaleFactor > 0 && pdfOriginalSize.width > 0) {
      const pos = signaturePositions.find(p => p.id === resizingSignatureId);
      if (!pos) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPixels = e.clientX - resizeStart.x;
      const deltaYPixels = e.clientY - resizeStart.y;
      
      // Convert pixels to PDF points
      const deltaXPoints = deltaXPixels / scaleFactor;
      const deltaYPoints = deltaYPixels / scaleFactor;
      
      // Calculate new size (maintain aspect ratio)
      const aspectRatio = resizeStart.width / resizeStart.height;
      let newWidth = resizeStart.width + deltaXPoints;
      let newHeight = resizeStart.height + deltaYPoints;
      
      // Maintain aspect ratio
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
      
      onSignatureResize(resizingSignatureId, newWidth, newHeight);
      return;
    }

    if (!isDraggingSignature || !draggedSignatureId || !containerRef.current || scaleFactor === 0 || pdfOriginalSize.width === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const xPixels = e.clientX - rect.left - dragOffset.x;
    const yPixels = e.clientY - rect.top - dragOffset.y;

    // Convert browser pixels to PDF points
    // Both browser and our storage use "from top" coordinate system
    const pdfX = xPixels / scaleFactor;
    const pdfY = yPixels / scaleFactor; // No inversion needed - we store as "from top"

    // Get the signature position to get its dimensions
    const pos = signaturePositions.find(p => p.id === draggedSignatureId);
    if (pos) {
      const signatureWidth = pos.width || (pdfOriginalSize.width * 0.15);
      const signatureHeight = pos.height || (pdfOriginalSize.height * 0.08);
      const clampedX = Math.max(0, Math.min(pdfOriginalSize.width - signatureWidth, pdfX));
      const clampedY = Math.max(0, Math.min(pdfOriginalSize.height - signatureHeight, pdfY));
      onSignatureMove(draggedSignatureId, clampedX, clampedY);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingSignature(false);
    setDraggedSignatureId(null);
    setIsResizing(false);
    setResizingSignatureId(null);
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = signaturePositions.find(p => p.id === id);
    if (!pos || !containerRef.current || scaleFactor === 0) return;
    
    setIsResizing(true);
    setResizingSignatureId(id);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: pos.width,
      height: pos.height,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!signatureDataUrl || !containerRef.current || pageSize.width === 0 || scaleFactor === 0 || pdfOriginalSize.width === 0) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Get drop position in browser pixels
    const dropXPixels = e.clientX - canvasRect.left;
    const dropYPixels = e.clientY - canvasRect.top;

    // Convert browser pixels to PDF points
    // Both use "from top" coordinate system for storage
    const dropXPoints = dropXPixels / scaleFactor;
    const dropYPoints = dropYPixels / scaleFactor; // No inversion - we store as "from top"

    onSignatureDrop(dropXPoints, dropYPoints, pdfOriginalSize.width, pdfOriginalSize.height);
    setIsDraggingFromSidebar(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDraggingFromSidebar(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFromSidebar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
              <X size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Pratinjau Halaman {pageNumber}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Seret tanda tangan ke halaman atau klik X untuk menghapus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* PDF Preview Area */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center p-8"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="relative bg-white shadow-2xl">
            <canvas 
              ref={canvasRef} 
              className="block cursor-crosshair"
              onClick={(e) => {
                // Allow clicking on canvas to add signature if not dragging existing signature
                if (!isDraggingSignature && signatureDataUrl && canvasRef.current && scaleFactor > 0 && pdfOriginalSize.width > 0) {
                  const canvasRect = canvasRef.current.getBoundingClientRect();
                  const dropXPixels = e.clientX - canvasRect.left;
                  const dropYPixels = e.clientY - canvasRect.top;
                  
                  // Convert browser pixels to PDF points
                  // Both use "from top" coordinate system for storage
                  const dropXPoints = dropXPixels / scaleFactor;
                  const dropYPoints = dropYPixels / scaleFactor; // No inversion - we store as "from top"
                  
                  onSignatureDrop(dropXPoints, dropYPoints, pdfOriginalSize.width, pdfOriginalSize.height);
                }
              }}
            />
            
            {/* Drop indicator */}
            {isDraggingFromSidebar && signatureDataUrl && (
              <div className="absolute inset-0 border-4 border-dashed border-blue-500 dark:border-blue-400 bg-blue-500/10 flex items-center justify-center pointer-events-none z-0">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    Lepaskan di sini untuk menambahkan tanda tangan
                  </p>
                </div>
              </div>
            )}
            
            {/* LAYER 2: Middle Layer - Interaction Canvas (Transparent for drop detection) */}
            {canvasRef.current && pageSize.width > 0 && (
              <div
                ref={interactionLayerRef}
                className="absolute z-10"
                style={{
                  left: 0,
                  top: 0,
                  width: `${pageSize.width}px`,
                  height: `${pageSize.height}px`,
                  pointerEvents: 'auto',
                }}
              />
            )}
            
            {/* LAYER 3: Top Layer - Draggable Signatures */}
            {signaturePositions.map((pos) => {
              // Convert PDF points to browser pixels
              // pos.x and pos.y are stored as top-left in PDF coordinate system
              // But PDF uses bottom-left origin, so we need to convert
              const browserX = (pos.x * scaleFactor);
              // Y conversion: PDF Y is from top, browser Y is from top (both same direction)
              // But we stored it as distance from top, so it's already correct for browser
              const browserY = (pos.y * scaleFactor);
              const browserWidth = (pos.width * scaleFactor);
              const browserHeight = (pos.height * scaleFactor);

              return (
                <div
                  key={pos.id}
                  className="absolute cursor-move group z-20"
                  style={{
                    left: `${browserX}px`,
                    top: `${browserY}px`,
                    width: `${browserWidth}px`,
                    height: `${browserHeight}px`,
                  }}
                  onMouseDown={(e) => {
                    // Don't start drag if clicking on resize handle
                    if ((e.target as HTMLElement).closest('.resize-handle')) {
                      return;
                    }
                    e.stopPropagation(); // Prevent canvas click
                    if (scaleFactor > 0 && pdfOriginalSize.width > 0) {
                      handleSignatureDragStart(e, pos.id, pos.x, pos.y);
                    }
                  }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent canvas click
                }}
                >
                  {signatureDataUrl && (
                    <div className="relative w-full h-full border-2 border-transparent group-hover:border-blue-400 dark:group-hover:border-blue-500 rounded transition-all">
                      <img
                        src={signatureDataUrl}
                        alt="Signature"
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSignatureRemove(pos.id);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute -left-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={16} className="text-slate-400" />
                      </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, pos.id)}
                        className="resize-handle absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 dark:bg-blue-600 border-2 border-white dark:border-slate-800 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-nwse-resize z-20 flex items-center justify-center"
                        title="Resize tanda tangan"
                      >
                        <Maximize2 size={10} className="text-white rotate-45" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        {signatureDataUrl && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t dark:border-slate-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
              💡 Seret tanda tangan dari sidebar ke halaman atau klik area halaman untuk menambahkannya. Drag tanda tangan yang sudah ada untuk mengatur posisi. Gunakan handle di sudut kanan bawah untuk resize.
            </p>
          </div>
        )}
        {!signatureDataUrl && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
              Buat tanda tangan terlebih dahulu di sidebar untuk menambahkannya ke halaman
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

