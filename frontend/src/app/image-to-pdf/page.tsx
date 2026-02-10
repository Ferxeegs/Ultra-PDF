"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ShieldCheck,
    Image as ImageIcon,
    Loader2,
    Zap,
    Lock,
    MousePointer2
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import { indexedDBManager } from "@/utils/indexedDB";

export default function ImageToPdfPage() {
    const router = useRouter();
    const [isDragging, setIsDragging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileUploadZoneRef = useRef<FileUploadZoneRef>(null);

    /**
     * Menangani file yang dipilih atau di-drop
     * Gambar disimpan ke IndexedDB agar bisa diakses di halaman Editor
     */
    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        // Filter hanya file gambar
        const imageFiles = Array.from(files).filter(
            (file) => file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name)
        );

        if (imageFiles.length === 0) {
            alert("Harap pilih file gambar (JPG, PNG, atau WEBP)");
            return;
        }

        setIsSaving(true);

        try {
            // Bersihkan storage lama sebelum memulai batch baru agar tidak tertukar
            await indexedDBManager.clearAll();

            // Simpan setiap file ke IndexedDB
            for (const file of imageFiles) {
                const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
                await indexedDBManager.saveFile(fileId, file);
            }

            // Setelah selesai simpan, arahkan ke halaman editor
            router.push("/image-to-pdf/editor");
        } catch (error) {
            console.error("Gagal memproses gambar:", error);
            alert("Terjadi kesalahan saat mempersiapkan gambar. Silakan coba lagi.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
            {/* Dekorasi Background Emerald (Hijau) - Identitas fitur Image to PDF */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-100/50 dark:bg-emerald-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
                        <ShieldCheck size={14} />
                        <span>Aman & Diproses Secara Lokal</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
                        Images to <span className="text-emerald-600">PDF</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
                        Ubah koleksi foto JPG, PNG, atau WEBP Anda menjadi satu dokumen PDF berkualitas tinggi secara instan.
                    </p>
                </header>

                <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-2">
                        {isSaving ? (
                            /* Tampilan saat file sedang ditulis ke IndexedDB */
                            <div className="h-48 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">Memproses Gambar</p>
                                    <p className="text-xs text-slate-500 mt-1">Menyiapkan editor untuk Anda...</p>
                                </div>
                            </div>
                        ) : (
                            <FileUploadZone
                                ref={fileUploadZoneRef}
                                isDragging={isDragging}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    handleFiles(e.dataTransfer.files);
                                }}
                                onFileChange={(e) => handleFiles(e.target.files)}
                                multiple={true}
                                accept="image/*"
                                label="Tarik dan lepas gambar di sini"
                                subLabel="Mendukung format JPG, PNG, dan WEBP"
                            />
                        )}
                    </div>
                </div>

                {/* Seksi Fitur di bawah kartu upload */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                            <Lock size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Privasi Tanpa Batas</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">File Anda tidak pernah diunggah ke cloud untuk pemrosesan awal. Semua terjadi di browser.</p>
                    </div>

                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                            <Zap size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Konversi Instan</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Dapatkan hasil PDF yang tajam dalam hitungan detik setelah Anda mengatur urutan.</p>
                    </div>

                    <div className="flex flex-col items-center text-center group">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                            <MousePointer2 size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Kendali Penuh</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Gunakan fitur drag-and-drop di halaman selanjutnya untuk mengatur tata letak halaman PDF.</p>
                    </div>
                </div>

                <Footer />
            </div>
        </main>
    );
}