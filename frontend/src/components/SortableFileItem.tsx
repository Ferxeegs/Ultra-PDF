"use client";

import { FileText, Trash2, GripVertical, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileObject } from "@/types";

interface SortableFileItemProps {
  fileObj: FileObject;
  index: number;
  onRemove: (id: string) => void;
  isProcessing?: boolean;
  isCurrentFile?: boolean;
}

export default function SortableFileItem({
  fileObj,
  index,
  onRemove,
  isProcessing = false,
  isCurrentFile = false,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileObj.id, disabled: isProcessing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

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
      style={style}
      className={`flex items-center justify-between p-4 bg-white rounded-xl border transition-all duration-200 ${
        isDragging
          ? "border-blue-500 shadow-xl ring-2 ring-blue-200 bg-blue-50/50 scale-[1.02]"
          : hasError
          ? "border-red-300 bg-red-50/30"
          : isProcessingFile
          ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-200"
          : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      } group`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`${
            isProcessing ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
          } text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0`}
        >
          <GripVertical size={20} />
        </div>

        {/* File Icon / Status Icon */}
        <div
          className={`p-2.5 rounded-lg flex-shrink-0 ${
            hasError
              ? "bg-red-100 text-red-600"
              : isProcessingFile
              ? "bg-blue-100 text-blue-600"
              : "bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600"
          }`}
        >
          {hasError ? (
            <AlertCircle size={20} />
          ) : isProcessingFile ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <FileText size={20} />
          )}
        </div>

        {/* File Info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {fileObj.file.name}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">
              {formatFileSize(fileObj.file.size)}
            </span>
            {hasError && (
              <span className="text-xs text-red-600 font-medium truncate">
                • {fileObj.error}
              </span>
            )}
            {isProcessingFile && (
              <span className="text-xs text-blue-600 font-medium">
                • Memproses...
              </span>
            )}
          </div>
        </div>

        {/* Index Badge */}
        <div
          className={`px-2.5 py-1 text-xs font-bold rounded-full flex-shrink-0 ${
            hasError
              ? "bg-red-100 text-red-700"
              : isProcessingFile
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          #{index + 1}
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(fileObj.id)}
        disabled={isProcessing}
        className={`ml-3 p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
          isProcessing
            ? "text-slate-300 cursor-not-allowed"
            : "text-slate-400 hover:text-red-500 hover:bg-red-50"
        }`}
        aria-label="Hapus file"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

