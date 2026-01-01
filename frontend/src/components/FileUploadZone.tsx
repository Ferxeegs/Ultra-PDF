"use client";

import { FilePlus } from "lucide-react";
import { useRef } from "react";

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

export default function FileUploadZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  multiple = true,
  label,
  subLabel,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-8 border-b border-slate-100">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02] shadow-lg shadow-blue-200/50"
            : "border-slate-300 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 hover:border-blue-400 hover:shadow-md"
        }`}
      >
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`p-4 rounded-full transition-all duration-300 ${
                isDragging
                  ? "bg-blue-100 scale-110"
                  : "bg-slate-100 group-hover:bg-blue-100"
              }`}
            >
              <FilePlus
                className={`w-10 h-10 transition-all duration-300 ${
                  isDragging
                    ? "text-blue-600 scale-110"
                    : "text-slate-400 group-hover:text-blue-600"
                }`}
              />
            </div>
            <div className="text-center">
              <p
                className={`text-sm font-medium transition-colors duration-300 ${
                  isDragging
                    ? "text-blue-700 font-semibold"
                    : "text-slate-700 group-hover:text-blue-700"
                }`}
              >
                {isDragging
                  ? "Lepaskan file di sini"
                  : label || (multiple ? "Tarik dan lepas file PDF di sini" : "Tarik dan lepas file PDF di sini")}
              </p>
              <p className="text-xs text-slate-500 mt-1">
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
}

