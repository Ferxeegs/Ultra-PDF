import { useEffect, useRef, useState, useCallback } from "react";
import { WorkerMessage } from "@/types";
import { indexedDBManager } from "@/utils/indexedDB";

export interface SplitResult {
  pageNumber: number;
  blob: Blob;
  fileName: string;
}

export function usePdfSplitWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [splitResults, setSplitResults] = useState<SplitResult[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileIdRef = useRef<string | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../app/workers/pdf-split.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const { status, data, message, currentFile, totalFiles } = event.data;
      
      if (status === "progress") {
        setProgress(data);
        if (currentFile !== undefined && totalFiles !== undefined) {
          setCurrentPage(currentFile);
          setTotalPages(totalFiles);
        }
      } else if (status === "page-progress") {
        // Update progress per halaman
        if (currentFile !== undefined && totalFiles !== undefined) {
          setCurrentPage(currentFile);
          setTotalPages(totalFiles);
        }
      } else if (status === "pdf-loaded") {
        // PDF berhasil di-load, dapatkan total pages
        if (typeof data === "number") {
          setTotalPages(data);
        }
        setIsProcessing(false);
      } else if (status === "success") {
        // Data berisi array of Uint8Array untuk setiap halaman/range atau single PDF untuk merge
        if (Array.isArray(data)) {
          // Split mode: multiple files
          const results: SplitResult[] = data.map((pageData: any, index: number) => {
            // pageData adalah Uint8Array dari worker
            const blob = new Blob([pageData as BlobPart], { type: "application/pdf" });
            return {
              pageNumber: index + 1,
              blob,
              fileName: `file-${index + 1}.pdf`,
            };
          });
          setSplitResults(results);
          
          // Buat zip file dari semua hasil split
          await createZipFromResults(results);
        } else if (data) {
          // Merge mode: single PDF
          const blob = new Blob([data as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setSplitResults([{
            pageNumber: 1,
            blob,
            fileName: "merged.pdf",
          }]);
        }
        setIsProcessing(false);
        setProgress(100);
        
        // JANGAN hapus file dari IndexedDB setelah selesai
        // File akan dihapus saat user navigate away atau reset
        // await cleanupFile();
      } else if (status === "error") {
        setFileError(message || "Error tidak diketahui");
        setIsProcessing(false);
        setProgress(0);
        
        // JANGAN hapus file dari IndexedDB meskipun error
        // File masih diperlukan untuk retry atau processing ulang
        // await cleanupFile();
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const cleanupFile = async () => {
    try {
      if (fileIdRef.current) {
        try {
          await indexedDBManager.deleteFile(fileIdRef.current);
        } catch (error) {
          // File mungkin sudah dihapus atau tidak ada, tidak masalah
          console.warn("File already deleted or not found:", fileIdRef.current);
        }
        fileIdRef.current = null;
      }
    } catch (error) {
      // Ignore errors saat cleanup
      console.warn("Error during cleanup:", error);
    }
  };

  const createZipFromResults = async (results: SplitResult[]) => {
    try {
      // Dynamic import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Tambahkan setiap PDF ke zip
      results.forEach((result) => {
        zip.file(result.fileName, result.blob);
      });

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      setDownloadUrl(zipUrl);
    } catch (error) {
      console.error("Error creating zip:", error);
      // Fallback: jika JSZip tidak tersedia, set downloadUrl ke null
      // User bisa download satu per satu dari splitResults
      // Note: JSZip perlu diinstall dengan: npm install jszip
      setDownloadUrl(null);
    }
  };

  const loadPdf = async (fileObject: { id: string; file: File }) => {
    setIsProcessing(true);
    setProgress(0);
    setFileError(null);
    
    // Set fileIdRef terlebih dahulu
    fileIdRef.current = fileObject.id;

    try {
      // Cek apakah file sudah ada di IndexedDB
      try {
        await indexedDBManager.getFile(fileObject.id);
        // File sudah ada, tidak perlu save lagi
      } catch {
        // File belum ada, simpan sekarang
        await indexedDBManager.saveFile(fileObject.id, fileObject.file);
      }
      
      // Buat URL untuk preview
      const url = URL.createObjectURL(fileObject.file);
      setPdfUrl(url);
      
      // Ambil ArrayBuffer dari IndexedDB untuk dikirim ke worker
      const arrayBuffer = await indexedDBManager.getFile(fileObject.id);
      
      // Kirim ke worker untuk load PDF dan get total pages
      workerRef.current?.postMessage({
        action: "load",
        id: fileObject.id,
        fileName: fileObject.file.name,
        arrayBuffer: arrayBuffer,
      });
    } catch (error) {
      console.error("Error preparing file:", error);
      setFileError("Error: " + (error as Error).message);
      setIsProcessing(false);
      setProgress(0);
      // Jangan hapus file saat error, mungkin masih diperlukan untuk retry
      // await cleanupFile();
    }
  };

  const processSelectedPages = async (
    selectedPages: number[],
    mode: "split" | "merge"
  ) => {
    if (selectedPages.length === 0) {
      setFileError("Pilih setidaknya satu halaman");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setSplitResults([]);
    setFileError(null);
    setCurrentPage(0);

    try {
      if (!fileIdRef.current) {
        throw new Error("File tidak ditemukan. Silakan refresh halaman dan upload ulang file.");
      }

      // Ambil ArrayBuffer dari IndexedDB dengan error handling
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await indexedDBManager.getFile(fileIdRef.current);
      } catch (error) {
        console.error("Error getting file from IndexedDB:", error);
        throw new Error("File tidak ditemukan di IndexedDB. Silakan refresh halaman dan upload ulang file.");
      }
      
      // Kirim ke worker untuk process selected pages
      workerRef.current?.postMessage({
        action: mode,
        selectedPages: selectedPages.sort((a, b) => a - b), // Sort ascending
        arrayBuffer: arrayBuffer,
      });
    } catch (error) {
      console.error("Error processing pages:", error);
      setFileError("Error: " + (error as Error).message);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const processRanges = async (
    ranges: Array<{ start: number; end: number }>,
    fileName?: string
  ) => {
    if (ranges.length === 0) {
      setFileError("Tentukan setidaknya satu rentang");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setSplitResults([]);
    setFileError(null);
    setCurrentPage(0);

    try {
      if (!fileIdRef.current) {
        throw new Error("File tidak ditemukan. Silakan refresh halaman dan upload ulang file.");
      }

      // Ambil ArrayBuffer dari IndexedDB dengan error handling
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await indexedDBManager.getFile(fileIdRef.current);
      } catch (error) {
        console.error("Error getting file from IndexedDB:", error);
        throw new Error("File tidak ditemukan di IndexedDB. Silakan refresh halaman dan upload ulang file.");
      }
      
      // Kirim ke worker untuk process ranges
      workerRef.current?.postMessage({
        action: "split-ranges",
        ranges: ranges,
        fileName: fileName || "document.pdf",
        arrayBuffer: arrayBuffer,
      });
    } catch (error) {
      console.error("Error processing ranges:", error);
      setFileError("Error: " + (error as Error).message);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const reset = useCallback(() => {
    try {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    } catch (error) {
      // Ignore errors saat revoke URL
      console.warn("Error revoking URL:", error);
    }
    setDownloadUrl(null);
    setPdfUrl(null);
    setProgress(0);
    setIsProcessing(false);
    setSplitResults([]);
    setFileError(null);
    setCurrentPage(0);
    setTotalPages(0);
    // Cleanup file secara async tanpa blocking
    cleanupFile().catch((error) => {
      // Ignore errors saat cleanup
      console.warn("Error during cleanup:", error);
    });
  }, [pdfUrl]);

  return {
    isProcessing,
    progress,
    downloadUrl,
    splitResults,
    fileError,
    totalPages,
    currentPage,
    pdfUrl,
    loadPdf,
    processSelectedPages,
    processRanges,
    reset,
  };
}

