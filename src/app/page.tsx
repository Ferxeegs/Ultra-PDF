"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Zap, Lock, MousePointer2 } from "lucide-react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";

import { usePdfWorker } from "@/hooks/usePdfWorker";
import { FileObject } from "@/types";
import FileUploadZone from "@/components/FileUploadZone";
import FileList from "@/components/FileList";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";

export default function Home() {
  const [fileObjects, setFileObjects] = useState<FileObject[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("pdf-merged");

  const { isProcessing, progress, downloadUrl, mergeFiles, reset } = usePdfWorker();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addFiles = (files: File[]) => {
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) return;

    const newObjects: FileObject[] = pdfFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
    }));

    setFileObjects((prev) => [...prev, ...newObjects]);
    reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  const handleMerge = async () => {
    if (fileObjects.length < 2) return;
    const files = fileObjects.map((obj) => obj.file);
    await mergeFiles(files);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFileObjects((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] relative py-16 px-4 sm:px-6">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-100/40 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Branding & Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>Secure & Local Processing</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">
            Ultra<span className="text-blue-600">PDF</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-xl mx-auto">
            Gabungkan dokumen PDF secara instan tanpa mengunggah file ke server. 
            Cepat, privat, dan tanpa batas ukuran.
          </p>
        </header>

        {/* Main Application Interface */}
        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-all duration-500">
          
          {/* Section: Upload */}
          <div className="p-2">
            <FileUploadZone
              isDragging={isDragging}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
              onFileChange={handleFileChange}
            />
          </div>

          {/* Section: List & Reorder */}
          <div className="px-8 pb-8">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Antrean Dokumen
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px]">
                  {fileObjects.length}
                </span>
              </h3>
              {fileObjects.length > 0 && (
                 <button 
                  onClick={() => setFileObjects([])} 
                  className="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
                >
                  Hapus Semua
                </button>
              )}
            </div>
            
            <FileList
              fileObjects={fileObjects}
              onDragEnd={handleDragEnd}
              onRemove={(id) => setFileObjects(prev => prev.filter(o => o.id !== id))}
            />
          </div>

          {/* Section: Execution & Progress */}
          <div className="p-8 bg-slate-50/50 border-t border-slate-100">
            {isProcessing && (
              <div className="mb-8">
                <ProgressBar progress={progress} />
              </div>
            )}

            {!downloadUrl ? (
              <button
                onClick={handleMerge}
                disabled={isProcessing || fileObjects.length < 2}
                className="group relative w-full py-5 bg-slate-900 text-white rounded-2xl font-bold overflow-hidden transition-all hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.98] shadow-xl hover:shadow-blue-200 disabled:shadow-none"
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <Zap size={20} className="fill-current" />
                  )}
                  <span className="text-lg">
                    {isProcessing ? "Menyatukan PDF..." : "Gabungkan Sekarang"}
                  </span>
                </div>
              </button>
            ) : (
              <DownloadSection
                downloadUrl={downloadUrl}
                fileName={downloadFileName}
                onFileNameChange={setDownloadFileName}
                onReset={() => { setFileObjects([]); reset(); }}
              />
            )}
          </div>
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Lock size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Privasi Total</h4>
            <p className="text-xs text-slate-400 leading-relaxed">File diproses di browser Anda, tidak pernah menyentuh server kami.</p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Performa Tinggi</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Menggunakan WebAssembly untuk kecepatan pemrosesan maksimal.</p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <MousePointer2 size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Mudah Digunakan</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Drag, drop, dan atur urutan sesuai keinginan Anda.</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200">
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              © 2025 Ferxcode | All Rights Reserved
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}