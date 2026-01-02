"use client";

import { FileText, Trash2, GripVertical, AlertCircle, Loader2, Eye } from "lucide-react"; // Tambahkan Eye
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileObject } from "@/types";

interface SortableFileItemProps {
  fileObj: FileObject;
  index: number;
  onRemove: (id: string) => void;
  onPreview: () => void; // Tambahkan prop onPreview
  isProcessing?: boolean;
  isCurrentFile?: boolean;
}

export default function SortableFileItem({
  fileObj,
  index,
  onRemove,
  onPreview, // Ambil dari props
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
      className={`flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-xl border transition-all duration-200 ${
        isDragging
          ? "border-blue-500 dark:border-blue-400 shadow-xl ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/50 dark:bg-blue-900/30 scale-[1.02]"
          : hasError
          ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20"
          : isProcessingFile
          ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md"
      } group`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`${
            isProcessing ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
          } text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex-shrink-0`}
        >
          <GripVertical size={20} />
        </div>

        {/* File Icon / Status Icon */}
        <div
          className={`p-2.5 rounded-lg flex-shrink-0 ${
            hasError
              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
              : isProcessingFile
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
              : "bg-gradient-to-br from-blue-50 dark:from-blue-900/30 to-indigo-50 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400"
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
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {fileObj.file.name}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatFileSize(fileObj.file.size)}
            </span>
            {hasError && (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium truncate">
                • {fileObj.error}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 ml-3">
        {/* Index Badge */}
        <div
          className={`px-2.5 py-1 text-[10px] font-bold rounded-full mr-2 ${
            hasError
              ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
              : isProcessingFile
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
          }`}
        >
          #{index + 1}
        </div>

        {/* Preview Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onPreview(); // Panggil fungsi preview
          }}
          disabled={isProcessing}
          className={`p-2 rounded-lg transition-all duration-200 ${
            isProcessing
              ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              : "text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          }`}
          title="Lihat isi PDF"
        >
          <Eye size={18} />
        </button>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(fileObj.id)}
          disabled={isProcessing}
          className={`p-2 rounded-lg transition-all duration-200 ${
            isProcessing
              ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              : "text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          }`}
          aria-label="Hapus file"
          title="Hapus file"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}