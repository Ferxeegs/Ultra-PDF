"use client";

import { FileText, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileObject } from "@/types";

interface SortableFileItemProps {
  fileObj: FileObject;
  index: number;
  onRemove: (id: string) => void;
}

export default function SortableFileItem({
  fileObj,
  index,
  onRemove,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileObj.id });

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 bg-white rounded-xl border transition-all duration-200 ${
        isDragging
          ? "border-blue-500 shadow-xl ring-2 ring-blue-200 bg-blue-50/50 scale-[1.02]"
          : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      } group`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0"
        >
          <GripVertical size={20} />
        </div>

        {/* File Icon */}
        <div className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-blue-600 flex-shrink-0">
          <FileText size={20} />
        </div>

        {/* File Info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {fileObj.file.name}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">
            {formatFileSize(fileObj.file.size)}
          </span>
        </div>

        {/* Index Badge */}
        <div className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full flex-shrink-0">
          #{index + 1}
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(fileObj.id)}
        className="ml-3 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 flex-shrink-0"
        aria-label="Hapus file"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

