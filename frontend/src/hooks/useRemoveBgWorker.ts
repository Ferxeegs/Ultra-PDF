import { useCallback, useRef, useState } from "react";
import { API_ENDPOINTS } from "@/utils/api";

export function useRemoveBgWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const removeBackground = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Mengupload gambar...");
    setError(null);
    setDownloadUrl(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;
          const current = Math.round((event.loaded / event.total) * 90);
          setProgress(current);
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response as Blob);
            return;
          }

          let message = `HTTP ${xhr.status}: ${xhr.statusText}`;
          try {
            const errorText = (xhr.response as Blob) ? await (xhr.response as Blob).text() : "";
            if (errorText) {
              const parsed = JSON.parse(errorText);
              message = parsed?.detail || message;
            }
          } catch {
            // ignore parse errors
          }
          reject(new Error(message));
        });

        xhr.addEventListener("error", () => reject(new Error("Gagal terhubung ke backend")));
        xhr.open("POST", API_ENDPOINTS.removeBg);
        xhr.responseType = "blob";
        xhr.send(formData);
      });

      setProgressMessage("Menyiapkan hasil...");
      setProgress(100);
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus background gambar");
      setProgress(0);
    } finally {
      setIsProcessing(false);
      xhrRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage("");
    setDownloadUrl(null);
    setError(null);
  }, [downloadUrl]);

  return {
    isProcessing,
    progress,
    progressMessage,
    downloadUrl,
    error,
    removeBackground,
    reset,
  };
}
