"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, Zap, Plus, Trash2 } from "lucide-react";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import { usePdfWorker } from "@/hooks/usePdfWorker";
import { FileObject } from "@/types";
import FilePreviewGrid from "@/components/FilePreviewGrid";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";
import { indexedDBManager } from "@/utils/indexedDB";

function MergeEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fileObjects, setFileObjects] = useState<FileObject[]>([]);
  const [downloadFileName, setDownloadFileName] = useState("pdf-merged");
  const [isLoading, setIsLoading] = useState(true);

  const { isProcessing, progress, downloadUrl, currentFile, fileErrors, mergeFiles, reset } = usePdfWorker();

  // Load files dari sessionStorage dan IndexedDB
  useEffect(() => {
    const loadFiles = async () => {
      const sessionId = searchParams.get("session");
      if (!sessionId) {
        router.push("/");
        return;
      }

      try {
        // Ambil session data dari sessionStorage
        const sessionDataStr = sessionStorage.getItem(`pdf-merge-session-${sessionId}`);
        if (!sessionDataStr) {
          router.push("/");
          return;
        }

        const sessionData = JSON.parse(sessionDataStr);
        const fileIds: string[] = sessionData.fileIds || [];

        if (fileIds.length === 0) {
          router.push("/");
          return;
        }

        // Load setiap file dari IndexedDB
        const loadedFiles: FileObject[] = [];
        for (const fileId of fileIds) {
          try {
            // Cek metadata
            const fileMetadataStr = sessionStorage.getItem(`pdf-merge-${fileId}`);
            if (!fileMetadataStr) continue;

            const fileMetadata = JSON.parse(fileMetadataStr);
            
            // Get file from IndexedDB
            const arrayBuffer = await indexedDBManager.getFile(fileId);
            const file = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });

            loadedFiles.push({
              id: fileId,
              file,
            });
          } catch (error) {
            console.error(`Error loading file ${fileId}:`, error);
            // Skip file yang error, tapi tetap lanjutkan
          }
        }

        if (loadedFiles.length < 2) {
          alert("Minimal 2 file diperlukan untuk merge. Redirecting...");
          router.push("/");
          return;
        }

        setFileObjects(loadedFiles);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading files:", error);
        router.push("/");
      }
    };

    loadFiles();
  }, [searchParams, router]);

  // Sync file errors dari worker ke fileObjects state
  useEffect(() => {
    if (fileErrors.length > 0) {
      setFileObjects((prev) =>
        prev.map((obj) => {
          const error = fileErrors.find((e) => e.fileId === obj.id);
          return error ? { ...obj, error: error.error } : obj;
        })
      );
    }
  }, [fileErrors]);

  const handleMerge = async () => {
    if (fileObjects.length < 2) return;
    // Reset error state pada file objects
    setFileObjects((prev) => prev.map((obj) => ({ ...obj, error: undefined, isProcessing: false })));
    await mergeFiles(fileObjects);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFileObjects((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update session data dengan urutan baru
        const sessionId = searchParams.get("session");
        if (sessionId) {
          try {
            const sessionDataStr = sessionStorage.getItem(`pdf-merge-session-${sessionId}`);
            if (sessionDataStr) {
              const sessionData = JSON.parse(sessionDataStr);
              sessionData.fileIds = newItems.map((item) => item.id);
              sessionStorage.setItem(`pdf-merge-session-${sessionId}`, JSON.stringify(sessionData));
            }
          } catch (error) {
            console.error("Error updating session data:", error);
          }
        }
        
        return newItems;
      });
    }
  };

  const handleRemove = async (id: string) => {
    if (fileObjects.length <= 2) {
      alert("Minimal 2 file diperlukan untuk merge");
      return;
    }

    // Hapus file dari state
    setFileObjects((prev) => prev.filter((o) => o.id !== id));

    // Update session data
    const sessionId = searchParams.get("session");
    if (sessionId) {
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-merge-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = sessionData.fileIds.filter((fileId: string) => fileId !== id);
          sessionStorage.setItem(`pdf-merge-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    }

    // Hapus dari IndexedDB dan sessionStorage (optional, bisa dibiarkan untuk cleanup nanti)
    try {
      await indexedDBManager.deleteFile(id);
      sessionStorage.removeItem(`pdf-merge-${id}`);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleBack = () => {
    try {
      reset();
    } catch (error) {
      console.warn("Error during reset:", error);
    }
    router.push("/");
  };

  const handleReset = () => {
    setFileObjects([]);
    reset();
    router.push("/");
  };

  const handleAddFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      alert("Hanya file PDF yang didukung");
      return;
    }

    const sessionId = searchParams.get("session");
    if (!sessionId) return;

    try {
      const newFileIds: string[] = [];

      // Simpan setiap file baru ke IndexedDB
      for (const file of pdfFiles) {
        const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
        await indexedDBManager.saveFile(fileId, file);
        newFileIds.push(fileId);

        // Simpan metadata ke sessionStorage
        const fileMetadata = {
          id: fileId,
          name: file.name,
        };
        sessionStorage.setItem(`pdf-merge-${fileId}`, JSON.stringify(fileMetadata));
      }

      // Load file baru ke state
      const newFiles: FileObject[] = [];
      for (const fileId of newFileIds) {
        try {
          const fileMetadataStr = sessionStorage.getItem(`pdf-merge-${fileId}`);
          if (!fileMetadataStr) continue;

          const fileMetadata = JSON.parse(fileMetadataStr);
          const arrayBuffer = await indexedDBManager.getFile(fileId);
          const file = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });

          newFiles.push({
            id: fileId,
            file,
          });
        } catch (error) {
          console.error(`Error loading new file ${fileId}:`, error);
        }
      }

      // Tambahkan ke state
      setFileObjects((prev) => [...prev, ...newFiles]);

      // Update session data
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-merge-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = [...sessionData.fileIds, ...newFileIds];
          sessionStorage.setItem(`pdf-merge-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    } catch (error) {
      console.error("Error adding files:", error);
      alert("Error menambahkan file. Pastikan browser mendukung IndexedDB dan ada cukup ruang penyimpanan.");
    }
  };


  // Update processing state berdasarkan currentFile
  useEffect(() => {
    if (isProcessing && currentFile) {
      setFileObjects((prev) =>
        prev.map((obj, index) => ({
          ...obj,
          isProcessing: index === currentFile.current - 1,
        }))
      );
    } else if (!isProcessing) {
      setFileObjects((prev) =>
        prev.map((obj) => ({ ...obj, isProcessing: false }))
      );
    }
  }, [isProcessing, currentFile]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" size={32} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Memuat file...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FDFDFF] dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Merge PDF Editor
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fileObjects.length} file
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Preview Grid - Takes remaining space */}
        <div className="flex-1 overflow-y-auto p-4">
          {!downloadUrl && (
            <>
              {/* File Preview Grid */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    Antrean Dokumen
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px]">
                      {fileObjects.length}
                    </span>
                  </h3>
                  {fileObjects.length > 0 && (
                    <button
                    onClick={handleReset}
                    className="group flex items-center gap-1.5 text-xs font-bold text-blue-500 dark:text-blue-400/80 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                  >
                    <Trash2 
                      size={16} 
                      className="transition-transform group-hover:-rotate-12" 
                    />
                    <span className="tracking-wider">
                      Hapus Semua
                    </span>
                  </button>
                  )}
                </div>

                <FilePreviewGrid
                  fileObjects={fileObjects}
                  onDragEnd={handleDragEnd}
                  onRemove={handleRemove}
                  isProcessing={isProcessing}
                  currentFileIndex={currentFile ? currentFile.current - 1 : null}
                />
              </div>

              {/* Processing State */}
              {isProcessing && (
                <div className="mb-4">
                  <ProgressBar progress={progress} />
                  {currentFile && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                      Memproses file {currentFile.current} dari {currentFile.total}
                    </p>
                  )}
                </div>
              )}

              {/* Error Messages */}
              {fileErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                    {fileErrors.length} file memiliki error:
                  </h4>
                  <ul className="space-y-1">
                    {fileErrors.map((error) => (
                      <li key={error.fileId} className="text-xs text-red-700 dark:text-red-400">
                        • <span className="font-medium">{error.fileName}</span>: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Download Results */}
          {downloadUrl && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                  Berhasil menggabungkan{" "}
                  <span className="text-blue-600 dark:text-blue-400">
                    {fileObjects.length} file
                  </span>{" "}
                  menjadi 1 file PDF
                </p>
              </div>

              <DownloadSection
                downloadUrl={downloadUrl}
                fileName={downloadFileName}
                onFileNameChange={setDownloadFileName}
                onReset={handleReset}
              />
            </div>
          )}
        </div>

        {/* Right: Sidebar - Fixed Width */}
        <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Info Section */}
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
                  Cara Menggunakan
                </h3>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Atur urutan file dengan drag & drop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Klik tombol "Gabungkan Sekarang"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Download hasil merge PDF</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">Total File:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{fileObjects.length}</span>
                </div>
                {fileObjects.length < 2 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Minimal 2 file diperlukan untuk merge
                  </p>
                )}
              </div>
            </div>

            {/* Add File Button */}
            {!downloadUrl && (
              <div className="pt-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = ".pdf";
                    input.onchange = (event) => {
                      const target = event.target as HTMLInputElement;
                      if (target.files) {
                        handleAddFiles(Array.from(target.files));
                      }
                    };
                    input.click();
                  }}
                  disabled={isProcessing}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500"
                >
                  <Plus size={18} />
                  <span>Tambah File</span>
                </button>
              </div>
            )}

            {/* Action Button */}
            {!downloadUrl && (
              <div className="pt-2">
                <button
                  onClick={handleMerge}
                  disabled={isProcessing || fileObjects.length < 2}
                  className="w-full py-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Menyatukan PDF...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={20} className="fill-current" />
                      <span>Gabungkan Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MergeEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <p className="text-slate-600 dark:text-slate-400">Memuat editor...</p>
          </div>
        </div>
      }
    >
      <MergeEditorContent />
    </Suspense>
  );
}

