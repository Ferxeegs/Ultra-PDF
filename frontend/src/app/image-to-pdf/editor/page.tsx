"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Zap,
    Loader2,
    Trash2,
    Plus,
    GripVertical,
    Image as ImageIcon,
    RotateCw,
    Settings,
    FileText,
    Maximize,
    X
} from "lucide-react";
import Link from "next/link";

// Dnd-kit untuk fitur drag-and-drop urutan
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { indexedDBManager } from "@/utils/indexedDB";
import { useConvertWorker } from "@/hooks/useConvertWorker";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";
import Footer from "@/components/Footer";

// --- Helper: Memproses Rotasi Gambar ke File Baru via Canvas ---
async function getRotatedFile(blob: Blob, fileName: string, degrees: number): Promise<File> {
    // Jika rotasi 0, kembalikan file asli tanpa proses canvas
    if (degrees % 360 === 0) return new File([blob], fileName, { type: blob.type });

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;

            // Hitung dimensi canvas baru (tukar lebar/tinggi jika rotasi 90/270 derajat)
            if (degrees % 180 !== 0) {
                canvas.width = img.height;
                canvas.height = img.width;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((degrees * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            canvas.toBlob((rotatedBlob) => {
                resolve(new File([rotatedBlob!], fileName, { type: "image/jpeg" }));
            }, "image/jpeg", 0.9);
        };
        img.src = URL.createObjectURL(blob);
    });
}

// --- Sub-Component: Item Gambar yang Bisa Disusun (Sortable) ---
interface SortableImageItemProps {
    id: string;
    preview: string;
    name: string;
    index: number;
    rotation: number; // Rotasi spesifik untuk item ini
    onRemove: (id: string) => void;
    onRotate: (id: string) => void;
}

function SortableImageItem({ id, preview, name, index, rotation, onRemove, onRotate }: SortableImageItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group rounded-xl overflow-hidden border transition-all duration-200 bg-white dark:bg-slate-800 ${isDragging
                    ? "border-emerald-500 shadow-2xl ring-2 ring-emerald-200 dark:ring-emerald-900/50 scale-105 z-50"
                    : "border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm"
                }`}
        >
            {/* Handle Drag */}
            <div 
                {...attributes} 
                {...listeners} 
                className="absolute top-2 left-2 w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            >
                <GripVertical size={14} className="text-slate-500 dark:text-slate-400" />
            </div>

            {/* Badge Nomor Urut */}
            <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg z-10">
                {index + 1}
            </div>

            {/* Pratinjau Gambar dengan Rotasi Visual */}
            <div className="aspect-[3/4] bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                <img
                    src={preview}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }}
                />
            </div>

            {/* Overlay dengan Info & Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[10px] text-white font-bold truncate mb-2">{name}</p>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRotate(id); }}
                            className="p-1.5 bg-emerald-500/90 hover:bg-emerald-600 text-white rounded-lg shadow-lg transition-colors flex-shrink-0"
                            title="Putar 90°"
                        >
                            <RotateCw size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(id); }}
                            className="p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-lg shadow-lg transition-colors flex-shrink-0"
                            title="Hapus"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Komponen Utama Editor ---
export default function ImagePdfEditor() {
    const router = useRouter();
    const [images, setImages] = useState<{ id: string; preview: string; name: string }[]>([]);
    const [rotations, setRotations] = useState<Record<string, number>>({}); // State rotasi per gambar
    const [pageSize, setPageSize] = useState<string>("a4");
    const [orientation, setOrientation] = useState<string>("portrait");
    const [isLoading, setIsLoading] = useState(true);
    const [resultFileName, setResultFileName] = useState("ultra-converted-images.pdf");
    const [showMobileSettings, setShowMobileSettings] = useState(false);

    const { convertFile, isProcessing, progress, progressMessage, downloadUrl, reset } = useConvertWorker();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Memuat data gambar dari IndexedDB
    const loadData = useCallback(async () => {
        try {
            const filesInfo = await indexedDBManager.getAllFilesInfo();
            const imageRecords = filesInfo.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.fileName));

            if (imageRecords.length === 0) {
                router.push("/image-to-pdf");
                return;
            }

            const items = await Promise.all(
                imageRecords.map(async (f) => {
                    const buffer = await indexedDBManager.getFile(f.id);
                    return {
                        id: f.id,
                        name: f.fileName,
                        preview: URL.createObjectURL(new Blob([buffer]))
                    };
                })
            );
            setImages(items);
        } catch (err) {
            console.error("Gagal memuat editor:", err);
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        loadData();
        return () => images.forEach(img => URL.revokeObjectURL(img.preview));
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setImages((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Logika rotasi spesifik per ID gambar
    const handleRotate = (id: string) => {
        setRotations(prev => ({
            ...prev,
            [id]: (prev[id] || 0) + 90 // Tambah 90 derajat setiap klik
        }));
    };

    const handleRemove = async (id: string) => {
        await indexedDBManager.deleteFile(id);
        setImages(prev => prev.filter(img => img.id !== id));
        if (images.length <= 1) router.push("/image-to-pdf");
    };

    const handleConvert = async () => {
        if (images.length === 0) return;

        // Memproses setiap gambar sesuai urutan dan rotasinya masing-masing
        const processedFiles = await Promise.all(
            images.map(async (img) => {
                const buffer = await indexedDBManager.getFile(img.id);
                const rotationDegrees = rotations[img.id] % 360 || 0; // Ambil rotasi untuk file ini

                // Buat file baru dengan orientasi yang sudah diperbaiki
                return await getRotatedFile(new Blob([buffer]), img.name, rotationDegrees);
            })
        );

        await convertFile(processedFiles, { type: 'image' });
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative transition-colors duration-200">
            <div className="flex flex-col h-screen">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/image-to-pdf" 
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                Image to PDF Editor
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {images.length} gambar
                            </p>
                        </div>
                    </div>

                    {!downloadUrl && (
                        <button
                            onClick={() => setShowMobileSettings(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Pengaturan"
                        >
                            <Settings size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    )}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">

                        {isProcessing && (
                            <div className="mb-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <ProgressBar progress={progress} label={progressMessage.toUpperCase()} />
                            </div>
                        )}

                        {images.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        Daftar Gambar
                                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px]">
                                            {images.length}
                                        </span>
                                    </h3>
                                </div>

                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                            {images.map((img, index) => (
                                                <SortableImageItem
                                                    key={img.id}
                                                    id={img.id}
                                                    preview={img.preview}
                                                    name={img.name}
                                                    index={index}
                                                    rotation={rotations[img.id] || 0}
                                                    onRemove={handleRemove}
                                                    onRotate={handleRotate}
                                                />
                                            ))}

                                            <Link 
                                                href="/image-to-pdf" 
                                                className="aspect-[3/4] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-all group"
                                            >
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                                                    <Plus size={20} />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Tambah</span>
                                            </Link>
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>
                        )}

                        {images.length === 0 && !isProcessing && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                    <ImageIcon size={48} className="text-slate-400 dark:text-slate-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                                    Belum ada gambar
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                    Tambahkan gambar untuk memulai konversi ke PDF
                                </p>
                                <Link
                                    href="/image-to-pdf"
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md"
                                >
                                    <Plus size={18} />
                                    <span>Tambah Gambar</span>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Settings */}
                    {!downloadUrl && (
                        <aside className="hidden lg:flex w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-col">
                            <div className="p-6 space-y-6 overflow-y-auto flex-1">
                                {/* Info Section */}
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                        <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                                            Cara Menggunakan
                                        </h3>
                                        <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-2">
                                            <li className="flex items-start gap-2">
                                                <span className="font-bold">1.</span>
                                                <span>Atur urutan gambar dengan drag & drop</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="font-bold">2.</span>
                                                <span>Putar gambar jika diperlukan</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="font-bold">3.</span>
                                                <span>Klik tombol "Konversi ke PDF"</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-600 dark:text-slate-400">Total Gambar:</span>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{images.length}</span>
                                        </div>
                                        {images.length === 0 && (
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                                Minimal 1 gambar diperlukan
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Settings Section */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <Settings size={16} />
                                        Pengaturan PDF
                                    </h3>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">
                                                Ukuran Kertas
                                            </label>
                                            <div className="space-y-2">
                                                {['a4', 'letter', 'fit'].map((size) => (
                                                    <button
                                                        key={size}
                                                        onClick={() => setPageSize(size)}
                                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${pageSize === size
                                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                            }`}
                                                    >
                                                        <span className="capitalize">{size === 'fit' ? 'Sesuai Gambar' : size.toUpperCase()}</span>
                                                        {pageSize === size && <FileText size={16} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">
                                                Orientasi
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { id: 'portrait', label: 'Potret', icon: Maximize },
                                                    { id: 'landscape', label: 'Lansekap', icon: ImageIcon }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => setOrientation(opt.id)}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-bold transition-all ${orientation === opt.id
                                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                            }`}
                                                    >
                                                        <opt.icon size={18} className={opt.id === 'landscape' ? 'rotate-90' : ''} />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons - Bottom */}
                            <div className="p-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                {/* Add Image Button */}
                                <Link
                                    href="/image-to-pdf"
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Plus size={18} />
                                    <span>Tambah Gambar</span>
                                </Link>

                                {/* Convert Button */}
                                <button
                                    onClick={handleConvert}
                                    disabled={isProcessing || images.length === 0}
                                    className="w-full py-4 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Mengonversi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={20} className="fill-current" />
                                            <span>Konversi ke PDF</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </aside>
                    )}
                </div>

                {/* Download Section */}
                {downloadUrl && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-100 dark:border-slate-700 shadow-lg">
                            <DownloadSection
                                downloadUrl={downloadUrl}
                                fileName={resultFileName}
                                onFileNameChange={setResultFileName}
                                onReset={() => { reset(); router.push("/image-to-pdf"); }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Settings Drawer */}
            {showMobileSettings && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowMobileSettings(false)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl border-t border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col">
                        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Settings size={20} />
                                Pengaturan & Aksi
                            </h3>
                            <button
                                onClick={() => setShowMobileSettings(false)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <X size={20} className="text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Info Section */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                                    Total Gambar
                                </h4>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {images.length}
                                </p>
                            </div>

                            {/* Settings */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">
                                    Ukuran Kertas
                                </label>
                                <div className="space-y-2">
                                    {['a4', 'letter', 'fit'].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => setPageSize(size)}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${pageSize === size
                                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                }`}
                                        >
                                            <span className="capitalize">{size === 'fit' ? 'Sesuai Gambar' : size.toUpperCase()}</span>
                                            {pageSize === size && <FileText size={16} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">
                                    Orientasi
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'portrait', label: 'Potret', icon: Maximize },
                                        { id: 'landscape', label: 'Lansekap', icon: ImageIcon }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setOrientation(opt.id)}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-bold transition-all ${orientation === opt.id
                                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                }`}
                                        >
                                            <opt.icon size={18} className={opt.id === 'landscape' ? 'rotate-90' : ''} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons - Bottom */}
                        <div className="p-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                            <Link
                                href="/image-to-pdf"
                                onClick={() => setShowMobileSettings(false)}
                                className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus size={18} />
                                <span>Tambah Gambar</span>
                            </Link>

                            <button
                                onClick={() => {
                                    handleConvert();
                                    setShowMobileSettings(false);
                                }}
                                disabled={isProcessing || images.length === 0}
                                className="w-full py-4 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Mengonversi...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={20} className="fill-current" />
                                        <span>Konversi ke PDF</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}