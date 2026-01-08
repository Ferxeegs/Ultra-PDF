"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FileText, X, Eye, Trash2 } from "lucide-react";
import PageThumbnail from "./PageThumbnail";

export interface PageItem {
  id: string; // Unique ID for the page
  pageNumber: number; // Page number within the file
  fileId: string; // ID of the file this page belongs to
  fileName: string; // Name of the file
  fileIndex: number; // Index of the file in the file list
  file: File; // File reference for lazy loading
  thumbnailUrl: string | null; // Deprecated: kept for backward compatibility
  isLoading: boolean; // Deprecated: kept for backward compatibility
}

interface SortablePageItemProps {
  page: PageItem;
  index: number; // Overall index in the page list
  isProcessing?: boolean;
  isDeleted?: boolean;
  deleteMode?: boolean;
  onToggleDelete?: () => void;
  onPreview?: () => void;
  onRemove?: () => void;
}

// Color palette for different files
const FILE_COLORS = [
  { 
    name: 'blue', 
    bg: 'bg-blue-500 dark:bg-blue-600', 
    border: 'border-blue-500 dark:border-blue-400',
    ring: 'ring-blue-200 dark:ring-blue-800',
    bgLight: 'bg-blue-50/50 dark:bg-blue-900/30',
    hover: 'hover:border-blue-300 dark:hover:border-blue-500',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400'
  },
  { 
    name: 'green', 
    bg: 'bg-green-500 dark:bg-green-600', 
    border: 'border-green-500 dark:border-green-400',
    ring: 'ring-green-200 dark:ring-green-800',
    bgLight: 'bg-green-50/50 dark:bg-green-900/30',
    hover: 'hover:border-green-300 dark:hover:border-green-500',
    hoverBg: 'hover:bg-green-50 dark:hover:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400'
  },
  { 
    name: 'purple', 
    bg: 'bg-purple-500 dark:bg-purple-600', 
    border: 'border-purple-500 dark:border-purple-400',
    ring: 'ring-purple-200 dark:ring-purple-800',
    bgLight: 'bg-purple-50/50 dark:bg-purple-900/30',
    hover: 'hover:border-purple-300 dark:hover:border-purple-500',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400'
  },
  { 
    name: 'pink', 
    bg: 'bg-pink-500 dark:bg-pink-600', 
    border: 'border-pink-500 dark:border-pink-400',
    ring: 'ring-pink-200 dark:ring-pink-800',
    bgLight: 'bg-pink-50/50 dark:bg-pink-900/30',
    hover: 'hover:border-pink-300 dark:hover:border-pink-500',
    hoverBg: 'hover:bg-pink-50 dark:hover:bg-pink-900/20',
    text: 'text-pink-600 dark:text-pink-400'
  },
  { 
    name: 'indigo', 
    bg: 'bg-indigo-500 dark:bg-indigo-600', 
    border: 'border-indigo-500 dark:border-indigo-400',
    ring: 'ring-indigo-200 dark:ring-indigo-800',
    bgLight: 'bg-indigo-50/50 dark:bg-indigo-900/30',
    hover: 'hover:border-indigo-300 dark:hover:border-indigo-500',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
    text: 'text-indigo-600 dark:text-indigo-400'
  },
  { 
    name: 'orange', 
    bg: 'bg-orange-500 dark:bg-orange-600', 
    border: 'border-orange-500 dark:border-orange-400',
    ring: 'ring-orange-200 dark:ring-orange-800',
    bgLight: 'bg-orange-50/50 dark:bg-orange-900/30',
    hover: 'hover:border-orange-300 dark:hover:border-orange-500',
    hoverBg: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400'
  },
  { 
    name: 'teal', 
    bg: 'bg-teal-500 dark:bg-teal-600', 
    border: 'border-teal-500 dark:border-teal-400',
    ring: 'ring-teal-200 dark:ring-teal-800',
    bgLight: 'bg-teal-50/50 dark:bg-teal-900/30',
    hover: 'hover:border-teal-300 dark:hover:border-teal-500',
    hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
    text: 'text-teal-600 dark:text-teal-400'
  },
  { 
    name: 'cyan', 
    bg: 'bg-cyan-500 dark:bg-cyan-600', 
    border: 'border-cyan-500 dark:border-cyan-400',
    ring: 'ring-cyan-200 dark:ring-cyan-800',
    bgLight: 'bg-cyan-50/50 dark:bg-cyan-900/30',
    hover: 'hover:border-cyan-300 dark:hover:border-cyan-500',
    hoverBg: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
    text: 'text-cyan-600 dark:text-cyan-400'
  },
];

// Map to store color for each fileId (consistent across reorders)
const fileColorMap = new Map<string, typeof FILE_COLORS[0]>();

const getFileColor = (fileId: string) => {
  if (!fileColorMap.has(fileId)) {
    // Assign color based on current map size (first come, first served)
    const colorIndex = fileColorMap.size % FILE_COLORS.length;
    fileColorMap.set(fileId, FILE_COLORS[colorIndex]);
  }
  return fileColorMap.get(fileId)!;
};

export default function SortablePageItem({
  page,
  index,
  isProcessing = false,
  isDeleted = false,
  deleteMode = false,
  onToggleDelete,
  onPreview,
  onRemove,
}: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: isProcessing });

  const fileColor = getFileColor(page.fileId);

  const style = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : 1,
    willChange: isDragging ? 'transform, opacity' : 'auto',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (deleteMode && onToggleDelete && !isProcessing) {
      e.stopPropagation();
      onToggleDelete();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(!deleteMode ? { ...attributes, ...listeners } : {})}
      onClick={handleClick}
      style={style}
      className={`
        relative group rounded-xl overflow-hidden border-2 transition-colors duration-200 ease-out
        ${isDeleted
          ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20"
          : isDragging
          ? `${fileColor.border} shadow-2xl ring-2 ${fileColor.ring} ${fileColor.bgLight} cursor-grabbing`
          : `border-slate-200 dark:border-slate-700 ${fileColor.hover} hover:shadow-md cursor-grab`
        }
        ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        ${deleteMode && !isProcessing ? "cursor-pointer" : ""}
      `}
    >
      {/* Thumbnail Preview */}
      <div className="aspect-[3/4] bg-white dark:bg-slate-900 flex items-center justify-center relative min-h-[200px] overflow-hidden">
        <PageThumbnail
          fileId={page.fileId}
          file={page.file}
          pageNum={page.pageNumber}
          scale={0.3}
          className="w-full h-full"
        />

        {/* Drag Indicator - Top Left (only show when not in delete mode) */}
        {!deleteMode && (
          <div
            className={`
              absolute top-2 left-2 w-6 h-6 bg-white dark:bg-slate-800 rounded-md flex items-center justify-center shadow-md pointer-events-none
              ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-60"}
              transition-opacity z-10
            `}
            title="Drag untuk mengubah urutan"
          >
            <GripVertical size={12} className="text-slate-600 dark:text-slate-300" />
          </div>
        )}

        {/* Delete Indicator - Top Left (only show in delete mode) */}
        {deleteMode && (
          <div
            className={`
              absolute top-2 left-2 w-7 h-7 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center shadow-md z-10
              ${isDeleted ? "opacity-100" : "opacity-60"}
              transition-opacity
            `}
            title={isDeleted ? "Klik untuk batalkan hapus" : "Klik untuk hapus"}
          >
            {isDeleted ? (
              <X size={14} className="text-white" />
            ) : (
              <div className="w-3 h-3 border-2 border-white rounded-sm" />
            )}
          </div>
        )}

        {/* Page Index Badge - Top Right */}
        <div
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md font-bold text-[10px] z-10 ${
            isDeleted
              ? "bg-red-500 dark:bg-red-600 text-white"
              : `${fileColor.bg} text-white`
          }`}
        >
          {index + 1}
        </div>

        {/* Deleted Overlay */}
        {isDeleted && (
          <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/30 flex items-center justify-center z-20">
            <div className="bg-red-500 dark:bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-lg">
              <p className="text-xs font-bold">DIHAPUS</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Bottom Right */}
        {!isDeleted && (
          <div 
            className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {onPreview && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onPreview();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className={`
                  w-6 h-6 rounded-md flex items-center justify-center shadow-md transition-all
                  ${isProcessing
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 ${fileColor.hoverBg} ${fileColor.text} cursor-pointer`
                  }
                `}
                title="Lihat preview"
              >
                <Eye size={12} />
              </button>
            )}
            {onRemove && !deleteMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className={`
                  w-6 h-6 rounded-md flex items-center justify-center shadow-md transition-all
                  ${isProcessing
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : "bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                  }
                `}
                title="Hapus halaman"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Page Info - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-2">
        <p className="text-xs font-bold text-white text-center truncate mb-0.5">
          {page.fileName}
        </p>
        <p className="text-[10px] text-white/80 text-center">
          Halaman {page.pageNumber}
        </p>
      </div>
    </div>
  );
}

