"use client";

import { useRef, useState } from "react";
import { AlertCircle, Eraser, Image as ImageIcon, Loader2, ShieldCheck } from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import ProgressBar from "@/components/ProgressBar";
import Footer from "@/components/Footer";
import { useRemoveBgWorker } from "@/hooks/useRemoveBgWorker";

export default function RemoveBgPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileUploadRef = useRef<FileUploadZoneRef>(null);

  const { isProcessing, progress, progressMessage, downloadUrl, error, removeBackground, reset } =
    useRemoveBgWorker();

  const handleFileChange = (selectedFile: File) => {
    const valid = selectedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(selectedFile.name);
    if (!valid) {
      alert("Hanya file gambar JPG, PNG, atau WEBP yang didukung.");
      return;
    }
    setFile(selectedFile);
    reset();
  };

  const handleResetAll = () => {
    setFile(null);
    reset();
    fileUploadRef.current?.reset();
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-100/50 dark:bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>Rembg + BiRefNet</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Remove <span className="text-purple-600 dark:text-purple-400">Background</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Upload satu gambar, hapus background otomatis, lalu unduh hasil PNG transparan.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-2">
            <FileUploadZone
              ref={fileUploadRef}
              isDragging={isDragging}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFileChange(dropped);
              }}
              onFileChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFileChange(selected);
              }}
              multiple={false}
              accept="image/png,image/jpeg,image/webp"
              label="Tarik dan lepas gambar di sini"
              subLabel="Mendukung JPG, PNG, dan WEBP"
            />

            {file && (
              <div className="p-6 pt-0">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-slate-100 dark:border-slate-600">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                    <ImageIcon size={24} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold truncate text-slate-800 dark:text-slate-200">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                {isProcessing && (
                  <div className="mb-6">
                    <ProgressBar progress={progress} label={progressMessage.toUpperCase()} />
                  </div>
                )}

                {!downloadUrl ? (
                  <button
                    onClick={() => removeBackground(file)}
                    disabled={isProcessing}
                    className="w-full py-5 bg-slate-900 dark:bg-purple-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Eraser size={20} className="group-hover:scale-125 transition-transform" />
                    )}
                    <span className="text-lg">Hapus Background</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <a
                      href={downloadUrl}
                      download={`${file.name.replace(/\.[^/.]+$/, "")}-transparent.png`}
                      className="block w-full text-center py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-colors"
                    >
                      Unduh PNG Transparan
                    </a>
                    <button
                      onClick={handleResetAll}
                      className="block w-full text-center py-3 border border-slate-200 dark:border-slate-600 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      Proses Gambar Lain
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
