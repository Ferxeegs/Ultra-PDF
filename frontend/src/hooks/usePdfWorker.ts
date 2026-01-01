import { useEffect, useRef, useState, useCallback } from "react";
import { WorkerMessage, FileError } from "@/types";
import { indexedDBManager } from "@/utils/indexedDB";

export function usePdfWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<{ current: number; total: number } | null>(null);
  const [fileErrors, setFileErrors] = useState<FileError[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const fileIdsRef = useRef<string[]>([]);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../app/workers/pdf.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const { status, data, message, fileId, fileName, currentFile: currFile, totalFiles } = event.data;
      
      if (status === "progress") {
        setProgress(data);
        if (currFile !== undefined && totalFiles !== undefined) {
          setCurrentFile({ current: currFile, total: totalFiles });
        }
      } else if (status === "file-progress") {
        // Update progress per file
        if (currFile !== undefined && totalFiles !== undefined) {
          setCurrentFile({ current: currFile, total: totalFiles });
        }
      } else if (status === "file-error") {
        // Error per file - tambahkan ke daftar error
        if (fileId && fileName && message) {
          setFileErrors((prev) => {
            // Hapus error sebelumnya untuk file ini jika ada
            const filtered = prev.filter((e) => e.fileId !== fileId);
            return [...filtered, { fileId, fileName, error: message }];
          });
        }
      } else if (status === "success") {
        const blob = new Blob([data], { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setIsProcessing(false);
        setProgress(100);
        
        // Cleanup: hapus file dari IndexedDB setelah selesai
        await cleanupFiles();
      } else if (status === "error") {
        // Error umum atau error dengan daftar file yang error
        if (Array.isArray(data)) {
          setFileErrors(data as FileError[]);
        }
        
        // Tampilkan error (bisa di-handle oleh UI)
        console.error("Error:", message);
        setIsProcessing(false);
        setProgress(0);
        
        // Cleanup: hapus file dari IndexedDB meskipun error
        await cleanupFiles();
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const cleanupFiles = async () => {
    try {
      // Hapus semua file yang sudah diproses dari IndexedDB
      await Promise.all(
        fileIdsRef.current.map((id) => indexedDBManager.deleteFile(id))
      );
      fileIdsRef.current = [];
    } catch (error) {
      console.error("Error cleaning up files:", error);
    }
  };

  const mergeFiles = async (fileObjects: Array<{ id: string; file: File }>) => {
    if (fileObjects.length < 2) return;
    
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setFileErrors([]);
    setCurrentFile(null);
    fileIdsRef.current = [];

    try {
      // Simpan semua file ke IndexedDB terlebih dahulu
      // Ini mengurangi penggunaan RAM karena file tidak disimpan di memory
      const fileDataPromises = fileObjects.map(async (fileObj) => {
        await indexedDBManager.saveFile(fileObj.id, fileObj.file);
        fileIdsRef.current.push(fileObj.id);
        
        // Ambil ArrayBuffer dari IndexedDB untuk dikirim ke worker
        // Worker akan memproses file ini dan tidak perlu menyimpan semua di memory
        const arrayBuffer = await indexedDBManager.getFile(fileObj.id);
        
        return {
          id: fileObj.id,
          fileName: fileObj.file.name,
          arrayBuffer: arrayBuffer,
        };
      });

      // Load file dari IndexedDB
      // File disimpan di IndexedDB (disk) bukan di React state (RAM)
      // ArrayBuffer hanya ada di memory sementara saat transfer ke worker
      // Worker akan memproses dan melepaskan memory setelah selesai
      const fileData = await Promise.all(fileDataPromises);

      // Kirim ke worker
      workerRef.current?.postMessage(fileData);
    } catch (error) {
      console.error("Error preparing files:", error);
      alert("Error: " + (error as Error).message);
      setIsProcessing(false);
      setProgress(0);
      await cleanupFiles();
    }
  };

  const reset = useCallback(() => {
    setDownloadUrl(null);
    setProgress(0);
    setIsProcessing(false);
    setFileErrors([]);
    setCurrentFile(null);
    cleanupFiles();
  }, []);

  return {
    isProcessing,
    progress,
    downloadUrl,
    currentFile,
    fileErrors,
    mergeFiles,
    reset,
  };
}

