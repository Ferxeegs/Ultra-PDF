"use client";

import { useState, useEffect } from "react";
import { Trash2, Database, HardDrive, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { indexedDBManager } from "@/utils/indexedDB";

interface FileInfo {
    id: string;
    fileName: string;
    fileSize: number;
    timestamp: number;
}

export default function SettingsPage() {
    const [indexedDBFiles, setIndexedDBFiles] = useState<FileInfo[]>([]);
    const [indexedDBSize, setIndexedDBSize] = useState<number>(0);
    const [sessionStorageSize, setSessionStorageSize] = useState<number>(0);
    const [sessionStorageItemCount, setSessionStorageItemCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isClearing, setIsClearing] = useState(false);
    const [clearStatus, setClearStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Format bytes ke format yang lebih mudah dibaca
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    // Format timestamp ke format yang lebih mudah dibaca
    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} hari yang lalu`;
        } else if (diffHours > 0) {
            return `${diffHours} jam yang lalu`;
        } else {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins > 0 ? `${diffMins} menit yang lalu` : "Baru saja";
        }
    };

    // Load data
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load IndexedDB files
            const files = await indexedDBManager.getAllFilesInfo();
            setIndexedDBFiles(files);
            
            // Calculate total size
            const totalSize = await indexedDBManager.getTotalSize();
            setIndexedDBSize(totalSize);

            // Calculate sessionStorage size (only in browser)
            if (typeof window !== 'undefined' && window.sessionStorage) {
                let sessionSize = 0;
                let itemCount = 0;
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        itemCount++;
                        const value = sessionStorage.getItem(key);
                        if (value) {
                            sessionSize += key.length + value.length;
                        }
                    }
                }
                setSessionStorageSize(sessionSize);
                setSessionStorageItemCount(itemCount);
            } else {
                setSessionStorageSize(0);
                setSessionStorageItemCount(0);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            setClearStatus({
                type: "error",
                message: "Gagal memuat data: " + (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Clear IndexedDB
    const handleClearIndexedDB = async () => {
        if (!confirm("Apakah Anda yakin ingin menghapus semua file di IndexedDB? Tindakan ini tidak dapat dibatalkan.")) {
            return;
        }

        setIsClearing(true);
        setClearStatus(null);
        try {
            await indexedDBManager.clearAll();
            await loadData();
            setClearStatus({
                type: "success",
                message: "Semua file di IndexedDB berhasil dihapus.",
            });
        } catch (error) {
            console.error("Error clearing IndexedDB:", error);
            setClearStatus({
                type: "error",
                message: "Gagal menghapus file: " + (error as Error).message,
            });
        } finally {
            setIsClearing(false);
        }
    };

    // Clear sessionStorage
    const handleClearSessionStorage = async () => {
        if (!confirm("Apakah Anda yakin ingin menghapus semua data di SessionStorage? Tindakan ini tidak dapat dibatalkan.")) {
            return;
        }

        setIsClearing(true);
        setClearStatus(null);
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.clear();
                await loadData();
                setClearStatus({
                    type: "success",
                    message: "Semua data di SessionStorage berhasil dihapus.",
                });
            } else {
                setClearStatus({
                    type: "error",
                    message: "SessionStorage tidak tersedia.",
                });
            }
        } catch (error) {
            console.error("Error clearing sessionStorage:", error);
            setClearStatus({
                type: "error",
                message: "Gagal menghapus data: " + (error as Error).message,
            });
        } finally {
            setIsClearing(false);
        }
    };

    // Clear old files (older than 24 hours)
    const handleCleanupOldFiles = async () => {
        setIsClearing(true);
        setClearStatus(null);
        try {
            await indexedDBManager.cleanupOldFiles();
            await loadData();
            setClearStatus({
                type: "success",
                message: "File lama (lebih dari 1 jam) berhasil dihapus.",
            });
        } catch (error) {
            console.error("Error cleaning up old files:", error);
            setClearStatus({
                type: "error",
                message: "Gagal menghapus file lama: " + (error as Error).message,
            });
        } finally {
            setIsClearing(false);
        }
    };

    // Delete single file
    const handleDeleteFile = async (fileId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus file ini?")) {
            return;
        }

        try {
            await indexedDBManager.deleteFile(fileId);
            // Also remove from sessionStorage if exists
            sessionStorage.removeItem(`pdf-split-${fileId}`);
            await loadData();
            setClearStatus({
                type: "success",
                message: "File berhasil dihapus.",
            });
        } catch (error) {
            console.error("Error deleting file:", error);
            setClearStatus({
                type: "error",
                message: "Gagal menghapus file: " + (error as Error).message,
            });
        }
    };

    return (
        <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-3">
                        Pengaturan <span className="text-blue-600 dark:text-blue-400">Penyimpanan</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Kelola data yang tersimpan di browser Anda
                    </p>
                </div>

                {/* Status Message */}
                {clearStatus && (
                    <div
                        className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
                            clearStatus.type === "success"
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                        }`}
                    >
                        {clearStatus.type === "success" ? (
                            <CheckCircle2 size={20} />
                        ) : (
                            <AlertCircle size={20} />
                        )}
                        <span className="text-sm font-medium">{clearStatus.message}</span>
                        <button
                            onClick={() => setClearStatus(null)}
                            className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Storage Overview */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* IndexedDB Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <Database size={24} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">IndexedDB</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {indexedDBFiles.length} file
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4">
                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                {formatBytes(indexedDBSize)}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearIndexedDB}
                                disabled={isClearing || indexedDBFiles.length === 0}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} />
                                Hapus Semua
                            </button>
                            <button
                                onClick={handleCleanupOldFiles}
                                disabled={isClearing}
                                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Hapus Lama
                            </button>
                        </div>
                    </div>

                    {/* SessionStorage Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                    <HardDrive size={24} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">SessionStorage</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {sessionStorageItemCount} item
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4">
                            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                                {formatBytes(sessionStorageSize)}
                            </p>
                        </div>
                        <button
                            onClick={handleClearSessionStorage}
                            disabled={isClearing || sessionStorageItemCount === 0}
                            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            Hapus Semua
                        </button>
                    </div>
                </div>

                {/* File List */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                            Daftar File di IndexedDB
                        </h2>
                        <button
                            onClick={loadData}
                            disabled={isLoading}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            <RefreshCw
                                size={20}
                                className={`text-slate-600 dark:text-slate-300 ${isLoading ? "animate-spin" : ""}`}
                            />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-12">
                            <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-slate-600 dark:text-slate-400">Memuat data...</p>
                        </div>
                    ) : indexedDBFiles.length === 0 ? (
                        <div className="text-center py-12">
                            <Database size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                            <p className="text-slate-600 dark:text-slate-400">Tidak ada file tersimpan</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {indexedDBFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                            {file.fileName}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            <span>{formatBytes(file.fileSize)}</span>
                                            <span>•</span>
                                            <span>{formatDate(file.timestamp)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteFile(file.id)}
                                        className="ml-4 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                        title="Hapus file"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Info:</strong> File yang lebih dari 1 jam akan otomatis dihapus saat aplikasi dibuka.
                        Anda juga dapat menghapus file secara manual menggunakan tombol di atas.
                    </p>
                </div>
            </div>
        </main>
    );
}

