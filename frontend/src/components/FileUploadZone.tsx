"use client";

import { FilePlus } from "lucide-react";
import { useRef, useImperativeHandle, forwardRef } from "react";

interface FileUploadZoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  multiple?: boolean;
  label?: string;
  subLabel?: string;
}

export interface FileUploadZoneRef {
  reset: () => void;
}

const FileUploadZone = forwardRef<FileUploadZoneRef, FileUploadZoneProps>(({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  multiple = true,
  label,
  subLabel,
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
  }));

  return (
    <div className="p-8 border-b border-slate-100 dark:border-slate-700">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-blue-500 dark:border-blue-400 bg-gradient-to-br from-blue-50 dark:from-blue-900/30 to-indigo-50 dark:to-indigo-900/30 scale-[1.02] shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50"
            : "border-slate-300 dark:border-slate-600 hover:bg-gradient-to-br hover:from-blue-50/50 dark:hover:from-blue-900/20 hover:to-indigo-50/50 dark:hover:to-indigo-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
        }`}
      >
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`p-4 rounded-full transition-all duration-300 ${
                isDragging
                  ? "bg-blue-100 dark:bg-blue-900/40 scale-110"
                  : "bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40"
              }`}
            >
              <FilePlus
                className={`w-10 h-10 transition-all duration-300 ${
                  isDragging
                    ? "text-blue-600 dark:text-blue-400 scale-110"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                }`}
              />
            </div>
            <div className="text-center">
              <p
                className={`text-sm font-medium transition-colors duration-300 ${
                  isDragging
                    ? "text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                }`}
              >
                {isDragging
                  ? "Lepaskan file di sini"
                  : label || (multiple ? "Tarik dan lepas file PDF di sini" : "Tarik dan lepas file PDF di sini")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {subLabel || "atau klik untuk memilih file"}
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept=".pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </label>
      </div>
    </div>
  );
});

FileUploadZone.displayName = "FileUploadZone";

export default FileUploadZone;

