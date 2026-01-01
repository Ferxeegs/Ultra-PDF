"use client";

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
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Daftar File
        </h2>
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
          {fileObjects.length} {fileObjects.length === 1 ? "file" : "files"}
        </span>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {fileObjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                <svg
                  className="w-8 h-8 text-slate-400 dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                Belum ada file
              </p>
              <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">
                Silakan upload file PDF terlebih dahulu
              </p>
            </div>
          ) : (
            <SortableContext
              items={fileObjects.map((obj) => obj.id)}
              strategy={verticalListSortingStrategy}
            >
              {fileObjects.map((obj, index) => (
                <SortableFileItem
                  key={obj.id}
                  fileObj={obj}
                  index={index}
                  onRemove={onRemove}
                  isProcessing={isProcessing}
                  isCurrentFile={currentFileIndex === index}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </DndContext>
    </div>
  );
}

