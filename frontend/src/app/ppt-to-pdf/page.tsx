"use client";

import { useState, useRef } from "react";
import {
    ShieldCheck,
    Presentation,
    Loader2,
    Zap,
    FileText,
    AlertCircle,
    Lock,
    MousePointer2
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";
import Footer from "@/components/Footer";
import { useConvertWorker } from "@/hooks/useConvertWorker";

export default function PptToPdfPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [resultFileName, setResultFileName] = useState("");
    const fileUploadRef = useRef<FileUploadZoneRef>(null);

    // Menggunakan hook custom untuk logika konversi
    const {
        convertFile,
        isProcessing,
        progress,
        progressMessage,
        downloadUrl,
        error,
        reset
    } = useConvertWorker();

    // Validasi file saat dipilih
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) validateAndSetFile(selectedFile);
    };

    const validateAndSetFile = (selectedFile: File) => {
        const isPpt = selectedFile.name.toLowerCase().endsWith(".ppt") ||
            selectedFile.name.toLowerCase().endsWith(".pptx") ||
            selectedFile.type === "application/vnd.ms-powerpoint" ||
            selectedFile.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

        if (!isPpt) {
            alert("Hanya file .ppt dan .pptx yang didukung");
            return;
        }
        setFile(selectedFile);
        reset(); // Reset status hook jika user ganti file
    };

    const handleConvert = async () => {
        if (!file) return;
        const extension = file.name.toLowerCase().endsWith(".pptx") ? ".pptx" : ".ppt";
        setResultFileName(file.name.replace(extension, ".pdf"));

        // Memanggil fungsi konversi dari hook
        await convertFile(file, { type: 'ppt' });
    };

    const handleReset = () => {
        setFile(null);
        reset();
        if (fileUploadRef.current) fileUploadRef.current.reset();
    };

    return (
        <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
            {/* Dekorasi Background Orange/Amber - Identitas fitur PPT to PDF */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-orange-100/50 dark:bg-orange-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-3xl mx-auto relative z-10">
                <header className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
                        <ShieldCheck size={14} />
                        <span>Aman & Diproses Secara Lokal</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
                        PowerPoint to <span className="text-orange-600 dark:text-orange-400">PDF</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
                        Ubah presentasi PowerPoint Anda menjadi PDF secara instan dengan tata letak dan font yang terjaga.
                    </p>
                </header>

                <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
                    {!downloadUrl ? (
                        <div className="p-2">
                            <FileUploadZone
                                ref={fileUploadRef}
                                isDragging={isDragging}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault(); setIsDragging(false);
                                    if (e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]);
                                }}
                                onFileChange={handleFileChange}
                                multiple={false}
                                accept=".ppt,.pptx"
                                label="Tarik dan lepas file PowerPoint di sini"
                                subLabel="Mendukung format .ppt dan .pptx"
                            />

                            {file && (
                                <div className="p-6 pt-0">
                                    {/* File Info Card */}
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-slate-100 dark:border-slate-600">
                                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                                            <Presentation size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-bold truncate text-slate-800 dark:text-slate-200">{file.name}</p>
                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        {!isProcessing && (
                                            <button
                                                onClick={() => setFile(null)}
                                                className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
                                            >
                                                Hapus
                                            </button>
                                        )}
                                    </div>

                                    {/* Error Handling */}
                                    {error && (
                                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                                            <AlertCircle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    {/* Progress Section */}
                                    {isProcessing && (
                                        <div className="mb-6">
                                            <ProgressBar progress={progress} label={progressMessage.toUpperCase()} />
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <button
                                        onClick={handleConvert}
                                        disabled={isProcessing}
                                        className="w-full py-5 bg-slate-900 dark:bg-orange-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <Zap size={20} className="group-hover:scale-125 transition-transform" />
                                        )}
                                        <span className="text-lg">Konversi Sekarang</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Download Section */
                        <div className="p-8 animate-in fade-in zoom-in duration-300">
                            <DownloadSection
                                downloadUrl={downloadUrl}
                                fileName={resultFileName}
                                onFileNameChange={setResultFileName}
                                onReset={handleReset}
                            />
                        </div>
                    )}
                </div>

                {/* Seksi Fitur di bawah kartu upload - Menyamakan dengan DocxToPdfPage */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                            <Lock size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Privasi Tanpa Batas</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">File presentasi Anda diproses secara aman dan tidak pernah disimpan secara permanen di server kami.</p>
                    </div>

                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                            <Zap size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Konversi Instan</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Ubah format PPT/PPTX yang kompleks menjadi PDF yang kompatibel secara luas dalam hitungan detik.</p>
                    </div>

                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                            <MousePointer2 size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Presisi Tinggi</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Teknologi konversi kami menjaga tata letak, font, animasi, dan elemen visual presentasi Anda tetap utuh.</p>
                    </div>
                </div>

                <Footer />
            </div>
        </main>
    );
}

