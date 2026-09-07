import { useCallback, useRef, useState } from "react";
import { API_ENDPOINTS } from "@/utils/api";

export function useRemoveBgWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopServerTicker = useCallback(() => {
    if (serverTimerRef.current) {
      clearInterval(serverTimerRef.current);
      serverTimerRef.current = null;
    }
  }, []);

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

          // Unggahan mengisi 0-70%; sisanya untuk inferensi model di server
          const current = Math.round((event.loaded / event.total) * 70);
          setProgress(current);
          setProgressMessage("Mengupload gambar...");
        });

        // Gambar sudah terkirim: model butuh waktu tanpa mengirim progres
        xhr.upload.addEventListener("load", () => {
          setProgressMessage("Model sedang menghapus background...");
          stopServerTicker();
          let current = 70;
          serverTimerRef.current = setInterval(() => {
            current = Math.min(97, current + 0.5);
            setProgress(current);
            if (current >= 97 && serverTimerRef.current) {
              clearInterval(serverTimerRef.current);
              serverTimerRef.current = null;
            }
          }, 200);
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
        xhr.addEventListener("abort", () => reject(new Error("__cancelled__")));
        xhr.open("POST", API_ENDPOINTS.removeBg);
        xhr.responseType = "blob";
        xhr.send(formData);
      });

      stopServerTicker();
      setProgressMessage("Selesai! Hasil siap diunduh.");
      setProgress(100);
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (e) {
      stopServerTicker();
      setProgress(0);
      setProgressMessage("");

      // Pembatalan oleh user bukan kesalahan yang perlu ditampilkan
      const message = e instanceof Error ? e.message : "Gagal menghapus background gambar";
      if (message !== "__cancelled__") setError(message);
    } finally {
      setIsProcessing(false);
      xhrRef.current = null;
    }
  }, [stopServerTicker]);

  const reset = useCallback(() => {
    stopServerTicker();
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
  }, [downloadUrl, stopServerTicker]);

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
