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
    Maximize
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
            className={`relative group rounded-2xl overflow-hidden border-2 transition-all duration-200 bg-white dark:bg-slate-800 ${isDragging
                    ? "border-emerald-500 shadow-2xl ring-2 ring-emerald-200 dark:ring-emerald-900/50 scale-105 z-50"
                    : "border-slate-200 dark:border-slate-700 hover:border-emerald-400 shadow-sm"
                }`}
        >
            {/* Handle Drag */}
            <div {...attributes} {...listeners} className="absolute top-2 left-2 w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-lg flex items-center justify-center shadow-sm opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
                <GripVertical size={16} className="text-slate-500" />
            </div>

            {/* Badge Nomor Urut */}
            <div className="absolute top-2 right-2 w-7 h-7 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg z-10">
                {index + 1}
            </div>

            {/* Pratinjau Gambar dengan Rotasi Visual */}
            <div className="aspect-[3/4] bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                <img
                    src={preview}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }} // Terapkan rotasi per gambar
                />
            </div>

            {/* Tombol Aksi: Rotasi & Hapus */}
            <div className="absolute bottom-2 right-2 flex gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity z-20">
                <button
                    onClick={(e) => { e.preventDefault(); onRotate(id); }}
                    className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg hover:bg-emerald-600 transition-colors"
                    title="Putar 90°"
                >
                    <RotateCw size={16} />
                </button>
                <button
                    onClick={(e) => { e.preventDefault(); onRemove(id); }}
                    className="p-2.5 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <p className="text-[10px] text-white font-bold truncate">{name}</p>
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
        <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-12 px-4 sm:px-6 transition-colors duration-200">
            <div className="max-w-7xl mx-auto relative z-10">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-5">
                        <Link href="/image-to-pdf" className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-sm group">
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
                                <ImageIcon className="text-emerald-600" /> Editor Gambar
                            </h1>
                            <p className="text-sm text-slate-500 font-medium">Atur urutan dan rotasi setiap gambar sesuai keinginan Anda.</p>
                        </div>
                    </div>

                    {!downloadUrl && (
                        <button
                            onClick={handleConvert}
                            disabled={isProcessing}
                            className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                            <span>Konversi ke PDF</span>
                        </button>
                    )}
                </div>

                {!downloadUrl ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-3 space-y-10">
                            {isProcessing && (
                                <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in">
                                    <ProgressBar progress={progress} label={progressMessage.toUpperCase()} />
                                </div>
                            )}

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {images.map((img, index) => (
                                            <SortableImageItem
                                                key={img.id}
                                                id={img.id}
                                                preview={img.preview}
                                                name={img.name}
                                                index={index}
                                                rotation={rotations[img.id] || 0} // Kirim rotasi spesifik
                                                onRemove={handleRemove}
                                                onRotate={handleRotate} // Kirim handler rotasi
                                            />
                                        ))}

                                        <Link href="/image-to-pdf" className="aspect-[3/4] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full group-hover:bg-emerald-100 transition-colors">
                                                <Plus size={24} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Tambah</span>
                                        </Link>
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>

                        <aside className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 border border-slate-100 dark:border-slate-700 shadow-sm sticky top-24">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Settings size={16} /> Pengaturan PDF
                                </h3>

                                <div className="space-y-4 mb-8">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Ukuran Kertas</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['a4', 'letter', 'fit'].map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => setPageSize(size)}
                                                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${pageSize === size
                                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                                                    : "border-slate-100 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                                                    }`}
                                            >
                                                <span className="capitalize">{size === 'fit' ? 'Sesuai Gambar' : size}</span>
                                                <FileText size={16} className={pageSize === size ? "opacity-100" : "opacity-0"} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Orientasi</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'portrait', label: 'Potret', icon: Maximize },
                                            { id: 'landscape', label: 'Lansekap', icon: ImageIcon }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setOrientation(opt.id)}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-bold transition-all ${orientation === opt.id
                                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                                                    : "border-slate-100 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                                                    }`}
                                            >
                                                <opt.icon size={18} className={opt.id === 'landscape' ? 'rotate-90' : ''} />
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 border border-slate-100 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-500">
                        <DownloadSection
                            downloadUrl={downloadUrl}
                            fileName={resultFileName}
                            onFileNameChange={setResultFileName}
                            onReset={() => { reset(); router.push("/image-to-pdf"); }}
                        />
                    </div>
                )}

                <Footer />
            </div>
        </main>
    );
}