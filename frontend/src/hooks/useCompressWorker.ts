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
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fungsi untuk mensimulasikan pergerakan progress kompresi (dari 99% ke 100%)
  const startCompressionProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Mulai dari 99% dan bergerak pelan ke 100%
    setProgress(99);
    
    const stepTime = 100; // Update setiap 100ms
    let currentProgress = 99;
    
    progressIntervalRef.current = setInterval(() => {
      currentProgress += 0.1; // Naik 0.1% setiap 100ms
      if (currentProgress >= 99.9) {
        currentProgress = 99.9; // Hentikan di 99.9%, akan di-set ke 100% saat selesai
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
      setProgress(currentProgress);
    }, stepTime);
  }, []);

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

    // Clear any existing progress simulation
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    try {
      const quality = options?.quality ?? "medium";

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", fileObject.file);
      formData.append("quality", quality);

      // Step 1: Upload dengan real progress (0% - 99%)
      setProgressMessage("Mengupload file ke server...");
      
      // Gunakan XMLHttpRequest untuk mendapatkan upload progress yang real
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        // Track upload progress (0% - 99%)
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            // Upload progress: 0% - 99% (sisakan 1% untuk kompresi)
            const uploadProgress = Math.min(99, (event.loaded / event.total) * 99);
            setProgress(uploadProgress);
          }
        });

        // Handle response
        xhr.addEventListener("load", async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // XHR response is already a blob when responseType is 'blob'
            const blob = xhr.response as Blob;
            const headers = new Headers();
            
            // Copy headers
            xhr.getAllResponseHeaders().split("\r\n").forEach((header) => {
              const [key, value] = header.split(": ");
              if (key && value) {
                headers.set(key, value);
              }
            });

            const responseInit: ResponseInit = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: headers,
            };

            // Create Response with blob
            const response = new Response(blob, responseInit);
            resolve(response);
          } else {
            // Try to read error message from response
            let errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
            try {
              if (xhr.responseType === "blob" && xhr.response) {
                const errorBlob = xhr.response as Blob;
                const errorText = await errorBlob.text();
                if (errorText && errorText.trim()) {
                  try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                  } catch {
                    errorMessage = errorText;
                  }
                }
              }
            } catch (e) {
              // Ignore error reading response
            }
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error occurred"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Request aborted"));
        });

        // Open and send request
        xhr.open("POST", API_ENDPOINTS.compress);
        xhr.responseType = "blob"; // Set response type to blob
        xhr.send(formData);
      });

      // Step 2: Server Processing (99% - 100%)
      setProgressMessage("Server sedang mengompres PDF...");
      startCompressionProgress();

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

      // Clear compression progress simulation
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
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

      setProgressMessage("Mendownload file yang sudah dikompres...");

      // Get the compressed PDF as blob (response is already a Response object with blob)
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

      // Step 3: Selesai (100%)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress(100); // Langsung ke 100 saat selesai
      setProgressMessage("Kompresi selesai! File siap diunduh.");

      // Create download URL
      const downloadUrlString = URL.createObjectURL(blob);
      setDownloadUrl(downloadUrlString);
      setIsProcessing(false);
      setFileError(null);
    } catch (error) {
      // Clear progress simulation on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Abort XHR if still running
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }

      // Don't show error if it was a cancellation
      if (error instanceof Error && (error.name === "AbortError" || error.message === "Request aborted")) {
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

    // Abort XHR if still running
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }

    // Clear progress simulation
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
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

