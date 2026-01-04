"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Scissors, Lock, MousePointer2 } from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import { indexedDBManager } from "@/utils/indexedDB";

export default function SplitPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const fileUploadZoneRef = useRef<FileUploadZoneRef>(null);

  const addFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Hanya file PDF yang didukung");
      return;
    }

    try {
      // Generate unique file ID
      const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
      
      // Store file in IndexedDB (supports large files)
      await indexedDBManager.saveFile(fileId, file);

      // Store only ID and fileName in sessionStorage (small data)
      const fileMetadata = {
        id: fileId,
        name: file.name,
      };
      sessionStorage.setItem(`pdf-split-${fileId}`, JSON.stringify(fileMetadata));

      // Navigate to editor
      router.push(`/split/editor?id=${encodeURIComponent(fileId)}`);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Error menyimpan file. Pastikan browser mendukung IndexedDB dan ada cukup ruang penyimpanan.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      addFile(selectedFile);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-100/40 dark:bg-indigo-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Branding & Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>Secure & Local Processing</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Split <span className="text-blue-600 dark:text-blue-400">PDF</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-xl mx-auto">
            Pisahkan atau gabungkan halaman PDF secara instan tanpa mengunggah file ke server. 
            Cepat, privat, dan tanpa batas ukuran.
          </p>
        </header>

        {/* Main Application Interface */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-500">
          <div className="p-2">
            <FileUploadZone
              ref={fileUploadZoneRef}
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
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <Lock size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Privasi Total</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">File diproses di browser Anda, tidak pernah menyentuh server kami.</p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <Scissors size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Pilih Halaman</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Pilih halaman yang ingin dipisah atau digabungkan dengan preview yang jelas.</p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <MousePointer2 size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Mudah Digunakan</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Drag, drop, pilih halaman, dan download hasilnya dengan mudah.</p>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </main>
  );
}
