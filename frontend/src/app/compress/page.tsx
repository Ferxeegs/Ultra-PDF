"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Zap, FileText, Settings } from "lucide-react";
import { useCompressWorker } from "@/hooks/useCompressWorker";
import { FileObject } from "@/types";
import { CompressionQuality } from "@/utils/api";
import FileUploadZone from "@/components/FileUploadZone";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";

export default function CompressPage() {
  const [fileObject, setFileObject] = useState<FileObject | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("pdf-compressed");
  const [quality, setQuality] = useState<CompressionQuality>("medium");

  const {
    isProcessing,
    progress,
    progressMessage,
    downloadUrl,
    fileError,
    compressFile,
    reset,
  } = useCompressWorker();

  const addFile = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Hanya file PDF yang didukung");
      return;
    }

    const newObject: FileObject = {
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
    };

    setFileObject(newObject);
    reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      addFile(selectedFile);
    }
  };

  const handleCompress = async () => {
    if (!fileObject) return;

    await compressFile(fileObject, {
      quality,
    });
  };

  const handleReset = () => {
    setFileObject(null);
    reset();
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
            <span>Server-Side Processing</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">
            Compress <span className="text-blue-600">PDF</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-xl mx-auto">
            Kompres ukuran file PDF Anda tanpa mengurangi kualitas. 
            Cepat, aman, dan diproses menggunakan Ghostscript di server.
          </p>
        </header>

        {/* Main Application Interface */}
        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-all duration-500">
          
          {/* Section: Upload */}
          {!fileObject && (
              <div className="p-2">
              <FileUploadZone
                isDragging={isDragging}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  setIsDragging(false); 
                  const file = e.dataTransfer.files[0];
                  if (file) addFile(file);
                }}
                onFileChange={handleFileChange}
                multiple={false}
                label="Tarik dan lepas file PDF di sini"
                subLabel="atau klik untuk memilih file (satu file)"
              />
            </div>
          )}

          {/* Section: File Info & Settings */}
          {fileObject && !downloadUrl && (
            <>
              <div className="px-8 pt-8 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} />
                    File yang Dipilih
                  </h3>
                  <button
                    onClick={() => setFileObject(null)}
                    className="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {fileObject.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(fileObject.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compression Settings */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={16} className="text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                      Pengaturan Kompresi
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Pilih Kualitas Kompresi
                      </label>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {/* Low Quality */}
                        <button
                          type="button"
                          onClick={() => setQuality("low")}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            quality === "low"
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="text-center">
                            <div className={`text-lg font-bold mb-1 ${
                              quality === "low" ? "text-blue-600" : "text-slate-700"
                            }`}>
                              Low
                            </div>
                            <div className="text-xs text-slate-500 mb-2">72 dpi</div>
                            <div className="text-xs text-slate-400">
                              Ukuran terkecil
                            </div>
                          </div>
                        </button>

                        {/* Medium Quality */}
                        <button
                          type="button"
                          onClick={() => setQuality("medium")}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            quality === "medium"
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="text-center">
                            <div className={`text-lg font-bold mb-1 ${
                              quality === "medium" ? "text-blue-600" : "text-slate-700"
                            }`}>
                              Medium
                            </div>
                            <div className="text-xs text-slate-500 mb-2">150 dpi</div>
                            <div className="text-xs text-slate-400">
                              Seimbang
                            </div>
                          </div>
                        </button>

                        {/* High Quality */}
                        <button
                          type="button"
                          onClick={() => setQuality("high")}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            quality === "high"
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="text-center">
                            <div className={`text-lg font-bold mb-1 ${
                              quality === "high" ? "text-blue-600" : "text-slate-700"
                            }`}>
                              High
                            </div>
                            <div className="text-xs text-slate-500 mb-2">300 dpi</div>
                            <div className="text-xs text-slate-400">
                              Kualitas tinggi
                            </div>
                          </div>
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 mt-3">
                        <span className="font-semibold text-slate-600">Low:</span> Kompresi maksimal, ukuran file terkecil. 
                        <span className="font-semibold text-slate-600 ml-2">Medium:</span> Keseimbangan ukuran dan kualitas. 
                        <span className="font-semibold text-slate-600 ml-2">High:</span> Kualitas tinggi dengan kompresi ringan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Execution & Progress */}
              <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                {isProcessing && (
                  <div className="mb-8">
                    <ProgressBar 
                      progress={progress} 
                      label={progressMessage || "MENGKOMPRES PDF..."}
                    />
                  </div>
                )}
                
                {/* Error Messages */}
                {fileError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <h4 className="text-sm font-semibold text-red-800 mb-1">
                      Error:
                    </h4>
                    <p className="text-xs text-red-700">{fileError}</p>
                  </div>
                )}

                {!downloadUrl ? (
                  <button
                    onClick={handleCompress}
                    disabled={isProcessing || !fileObject}
                    className="group relative w-full py-5 bg-slate-900 text-white rounded-2xl font-bold overflow-hidden transition-all hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.98] shadow-xl hover:shadow-blue-200 disabled:shadow-none"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-3">
                      {isProcessing ? (
                        <Loader2 className="animate-spin" size={22} />
                      ) : (
                        <Zap size={20} className="fill-current" />
                      )}
                      <span className="text-lg">
                        {isProcessing ? "Mengompres PDF..." : "Kompres Sekarang"}
                      </span>
                    </div>
                  </button>
                ) : (
                  <DownloadSection
                    downloadUrl={downloadUrl}
                    fileName={downloadFileName}
                    onFileNameChange={setDownloadFileName}
                    onReset={handleReset}
                  />
                )}
              </div>
            </>
          )}

          {/* Section: Download (when completed) */}
          {fileObject && downloadUrl && (
            <div className="p-8">
              <DownloadSection
                downloadUrl={downloadUrl}
                fileName={downloadFileName}
                onFileNameChange={setDownloadFileName}
                onReset={handleReset}
              />
            </div>
          )}
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Ghostscript Powered</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Menggunakan Ghostscript untuk kompresi PDF profesional dengan kualitas terjamin.</p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Optimasi Cerdas</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Tiga level kualitas: Low (72 dpi), Medium (150 dpi), High (300 dpi) untuk hasil optimal.</p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Settings size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Kontrol Penuh</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Pilih tingkat kompresi sesuai kebutuhan Anda dengan kontrol yang mudah.</p>
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
