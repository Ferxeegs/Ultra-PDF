"use client";

import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableFileItem from "./SortableFileItem";
import { FileObject } from "@/types";

interface FileListProps {
  fileObjects: FileObject[];
  onDragEnd: (event: DragEndEvent) => void;
  onRemove: (id: string) => void;
  isProcessing?: boolean;
  currentFileIndex?: number | null;
}

export default function FileList({
  fileObjects,
  onDragEnd,
  onRemove,
  isProcessing = false,
  currentFileIndex = null,
}: FileListProps) {
  // State untuk mengelola preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handlePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl); // Bersihkan memori
      setPreviewUrl(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Daftar File
        </h2>
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full">
          {fileObjects.length} {fileObjects.length === 1 ? "FILE" : "FILES"}
        </span>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {fileObjects.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Belum ada file diunggah</p>
            </div>
          ) : (
            <SortableContext items={fileObjects.map((obj) => obj.id)} strategy={verticalListSortingStrategy}>
              {fileObjects.map((obj, index) => (
                <SortableFileItem
                  key={obj.id}
                  fileObj={obj}
                  index={index}
                  onRemove={onRemove}
                  onPreview={() => handlePreview(obj.file)} // Kirim fungsi preview
                  isProcessing={isProcessing}
                  isCurrentFile={currentFileIndex === index}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </DndContext>

      {/* --- MODAL PREVIEW --- */}
      {previewUrl && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">Preview Dokumen</h3>
              <button 
                onClick={closePreview}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Iframe Viewport */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900">
              <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}