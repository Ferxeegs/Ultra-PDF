import { useState, useCallback, useRef } from "react";
import { API_ENDPOINTS, CompressionQuality } from "@/utils/api";

interface CompressOptions {
  quality?: CompressionQuality; // 'low' | 'medium' | 'high', default 'medium'
}

export function useCompressWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const compressFile = async (
    fileObject: { id: string; file: File },
    options?: CompressOptions
  ) => {
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setFileError(null);
    setOriginalSize(fileObject.file.size);
    setCompressedSize(null);
    setProgressMessage("Mempersiapkan file untuk diupload...");

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const quality = options?.quality ?? "medium";

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", fileObject.file);
      formData.append("quality", quality);

      setProgress(10);
      setProgressMessage("Mengupload file ke server...");

      // Upload file and get compressed PDF
      // Send quality as form data (multipart/form-data)
      const response = await fetch(API_ENDPOINTS.compress, {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      setProgress(50);
      setProgressMessage("Server sedang mengompres PDF...");

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } else {
            // Clone response to read text without consuming the body
            const clonedResponse = response.clone();
            const errorText = await clonedResponse.text();
            if (errorText && errorText.trim()) {
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        console.error("Server error:", errorMessage);
        throw new Error(errorMessage);
      }

      // Check if response is actually a PDF file
      const contentType = response.headers.get("content-type");
      // console.log("Response content-type:", contentType);
      
      if (!contentType || (!contentType.includes("application/pdf") && !contentType.includes("application/octet-stream"))) {
        // If not PDF, try to read as text to see error message
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        console.error("Unexpected content type. Response:", errorText.substring(0, 200));
        throw new Error("Server tidak mengembalikan file PDF. Pastikan backend berjalan dengan benar.");
      }

      setProgress(80);
      setProgressMessage("Mendownload file yang sudah dikompres...");

      // Get the compressed PDF as blob
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("File hasil kompresi kosong. Pastikan file PDF valid.");
      }

      // Verify it's a PDF
      if (!blob.type.includes("application/pdf") || blob.size < 100) {
        // If blob is too small or wrong type, might be an error message
        const text = await blob.text();
        if (text.includes("error") || text.includes("Error") || text.includes("detail")) {
          throw new Error(`Server error: ${text}`);
        }
      }

      // Store compressed size
      setCompressedSize(blob.size);

      // Create download URL
      const downloadUrlString = URL.createObjectURL(blob);
      setDownloadUrl(downloadUrlString);
      setProgress(100);
      setProgressMessage("Kompresi selesai! File siap diunduh.");
      setIsProcessing(false);
      setFileError(null);
    } catch (error) {
      // Don't show error if it was a cancellation
      if (error instanceof Error && error.name === "AbortError") {
        setIsProcessing(false);
        setProgress(0);
        setProgressMessage("");
        return;
      }

      console.error("Error compressing file:", error);
      setFileError(
        error instanceof Error
          ? error.message
          : "Terjadi error saat mengompres PDF. Pastikan backend server berjalan."
      );
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage("");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    // Cancel ongoing request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Cleanup download URL
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }

    setDownloadUrl(null);
    setProgress(0);
    setIsProcessing(false);
    setFileError(null);
    setProgressMessage("");
    setOriginalSize(null);
    setCompressedSize(null);
  }, [downloadUrl]);

  return {
    isProcessing,
    progress,
    progressMessage,
    downloadUrl,
    fileError,
    originalSize,
    compressedSize,
    compressFile,
    reset,
  };
}

