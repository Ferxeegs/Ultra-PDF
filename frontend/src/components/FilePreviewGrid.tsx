"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { FileText, Trash2, GripVertical, AlertCircle, Loader2, Eye, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileObject } from "@/types";

interface SortableFilePreviewProps {
  fileObj: FileObject;
  index: number;
  onRemove: (id: string) => void;
  onPreview: (file: File) => void;
  isProcessing?: boolean;
  isCurrentFile?: boolean;
}

function SortableFilePreview({
  fileObj,
  index,
  onRemove,
  onPreview,
  isProcessing = false,
  isCurrentFile = false,
}: SortableFilePreviewProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileObj.id, disabled: isProcessing });

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : 1,
    willChange: isDragging ? 'transform, opacity' : 'auto',
  };

  // Generate thumbnail from PDF
  useEffect(() => {
    const generateThumbnail = async () => {
      try {
        setIsLoadingThumbnail(true);
        const url = URL.createObjectURL(fileObj.file);
        setPdfUrl(url);

        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({
          url: url,
          verbosity: 0,
        });
        const pdf = await loadingTask.promise;

        // Get first page
        const page = await pdf.getPage(1);
        const scale = 0.6;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not get canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setThumbnailUrl(dataUrl);
        setIsLoadingThumbnail(false);
      } catch (error) {
        console.error("Error generating thumbnail:", error);
        setIsLoadingThumbnail(false);
      }
    };

    if (fileObj.file && !fileObj.error) {
      generateThumbnail();
    } else {
      setIsLoadingThumbnail(false);
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [fileObj.file, fileObj.error]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const hasError = !!fileObj.error;
  const isProcessingFile = isProcessing && isCurrentFile;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        cursor: isProcessing ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
      }}
      className={`
        relative group rounded-xl overflow-hidden border-2
        transition-colors duration-200 ease-out
        ${isDragging
          ? "border-blue-500 dark:border-blue-400 shadow-2xl ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/50 dark:bg-blue-900/30"
          : hasError
          ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20"
          : isProcessingFile
          ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md"
        }
      `}
    >
      {/* Thumbnail Preview */}
      <div className="aspect-[3/4] bg-white dark:bg-slate-900 flex items-center justify-center relative min-h-[200px]">
        {isLoadingThumbnail ? (
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Memuat...</p>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Preview ${fileObj.file.name}`}
            className="w-full h-full object-contain"
          />
        ) : hasError ? (
          <div className="text-center p-2">
            <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400 mx-auto mb-1" />
            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Error</p>
          </div>
        ) : (
          <div className="text-center p-2">
            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-1" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Preview tidak tersedia</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessingFile && (
          <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-md p-2 shadow-xl">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Memproses...</p>
            </div>
          </div>
        )}

        {/* Drag Indicator - Top Left */}
        <div
          className={`
            absolute top-2 left-2 w-6 h-6 bg-white dark:bg-slate-800 rounded-md flex items-center justify-center shadow-md pointer-events-none
            ${isDragging ? "opacity-100" : "opacity-60"}
            transition-opacity z-10
          `}
          title="Drag untuk mengubah urutan"
        >
          <GripVertical size={12} className="text-slate-600 dark:text-slate-300" />
        </div>

        {/* Index Badge - Top Right */}
        <div
          className={`
            absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md font-bold text-[10px] z-10
            ${hasError
              ? "bg-red-500 dark:bg-red-600 text-white"
              : isProcessingFile
              ? "bg-blue-500 dark:bg-blue-600 text-white"
              : "bg-slate-700 dark:bg-slate-600 text-white"
            }
          `}
        >
          {index + 1}
        </div>

        {/* Overlay Zoom on Hover */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors pointer-events-none" />
        
        {/* Action Buttons - Top Right */}
        <div 
          className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onPreview(fileObj.file);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isProcessing || hasError}
            className={`
              p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 transition-all hover:scale-110 active:scale-95
              ${isProcessing || hasError
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer"
              }
            `}
            title="Lihat preview"
          >
            <Eye size={14} className="text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(fileObj.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isProcessing}
            className={`
              p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 transition-all hover:scale-110 active:scale-95
              ${isProcessing
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer"
              }
            `}
            title="Hapus file"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        </div>

        {/* Error Message Overlay */}
        {hasError && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 dark:bg-red-600/90 text-white p-1.5">
            <p className="text-[10px] font-semibold text-center truncate">{fileObj.error}</p>
          </div>
        )}
      </div>

      {/* File Info - Bottom */}
      {!hasError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-2">
          <p className="text-xs font-bold text-white text-center truncate mb-0.5">
            {fileObj.file.name}
          </p>
          <p className="text-[10px] text-white/80 text-center">
            {formatFileSize(fileObj.file.size)}
          </p>
        </div>
      )}
    </div>
  );
}

interface FilePreviewGridProps {
  fileObjects: FileObject[];
  onDragEnd: (event: DragEndEvent) => void;
  onRemove: (id: string) => void;
  isProcessing?: boolean;
  currentFileIndex?: number | null;
}

export default function FilePreviewGrid({
  fileObjects,
  onDragEnd,
  onRemove,
  isProcessing = false,
  currentFileIndex = null,
}: FilePreviewGridProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Configure sensors for better drag performance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px of movement before activating drag (reduced for better responsiveness)
      },
    })
  );

  const handlePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter} 
        onDragEnd={onDragEnd}
      >
        {fileObjects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
            <p className="text-slate-400 dark:text-slate-500 text-sm">Belum ada file diunggah</p>
          </div>
        ) : (
          <SortableContext items={fileObjects.map((obj) => obj.id)} strategy={rectSortingStrategy}>
            <div 
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[500px] overflow-y-auto p-1 pb-4 custom-scrollbar" 
              style={{ 
                willChange: 'transform',
                overscrollBehavior: 'contain',
                scrollPaddingBlock: '1rem'
              }}
            >
              {fileObjects.map((obj, index) => (
                <SortableFilePreview
                  key={obj.id}
                  fileObj={obj}
                  index={index}
                  onRemove={onRemove}
                  onPreview={handlePreview}
                  isProcessing={isProcessing}
                  isCurrentFile={currentFileIndex === index}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </DndContext>

      {/* Preview Modal - Using style like RangePreview */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
                  <FileText size={20}/>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    Pratinjau Dokumen
                  </h3>
                </div>
              </div>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            {/* Iframe Viewport */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

