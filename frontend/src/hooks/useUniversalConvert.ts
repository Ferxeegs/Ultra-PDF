import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConvertJob,
  convertJobResultUrl,
  convertJobUrl,
} from "@/utils/api";

export interface ConvertResult {
  url: string;
  fileName: string;
  /** MIME type hasil, dipakai untuk memutuskan apakah pratinjau PDF bisa ditampilkan */
  mimeType: string;
}

interface RunOptions {
  endpoint: string;
  formData: FormData;
  /**
   * Jalankan sebagai job latar belakang. Wajib untuk berkas besar karena
   * konversi LibreOffice bisa melampaui batas timeout HTTP/proxy.
   */
  background?: boolean;
}

const POLL_INTERVAL_MS = 1500;

function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  return plainMatch ? plainMatch[1] : fallback;
}

/**
 * Hook konversi universal: mendukung mode sinkron (unduhan langsung) maupun
 * job async dengan polling status, dan bisa dibatalkan di kedua mode.
 */
export function useUniversalConvert() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const clearServerTimer = useCallback(() => {
    if (serverTimerRef.current) {
      clearInterval(serverTimerRef.current);
      serverTimerRef.current = null;
    }
  }, []);

  /**
   * Mode sinkron tidak punya endpoint status, jadi rentang 40-95% diisi animasi
   * lambat setelah unggahan selesai supaya bar tidak terlihat membeku.
   */
  const startServerTicker = useCallback(() => {
    clearServerTimer();
    let current = 40;
    serverTimerRef.current = setInterval(() => {
      current = Math.min(95, current + 0.4);
      setProgress(current);
      if (current >= 95) clearServerTimer();
    }, 250);
  }, [clearServerTimer]);

  // Bebaskan object URL terakhir saat komponen dilepas
  useEffect(() => {
    return () => {
      clearPollTimer();
      clearServerTimer();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, [clearServerTimer]);

  const publishResult = useCallback((blob: Blob, fileName: string) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    const url = URL.createObjectURL(blob);
    resultUrlRef.current = url;
    setResult({ url, fileName, mimeType: blob.type });
  }, []);

  const uploadSync = useCallback(
    (endpoint: string, formData: FormData) =>
      new Promise<{ blob: Blob; fileName: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            // Unggahan dianggap 40% pertama; sisanya milik proses di server
            setProgress(Math.round((event.loaded / event.total) * 40));
            setStatusMessage("Mengunggah berkas");
          }
        });

        // Unggahan tuntas: server mulai bekerja tanpa mengirim progres
        xhr.upload.addEventListener("load", () => {
          setStatusMessage("Server sedang mengonversi");
          startServerTicker();
        });

        xhr.addEventListener("load", async () => {
          clearServerTimer();
          if (xhr.status >= 200 && xhr.status < 300) {
            const blob = xhr.response as Blob;
            resolve({
              blob,
              fileName: fileNameFromDisposition(
                xhr.getResponseHeader("Content-Disposition"),
                "hasil-konversi"
              ),
            });
            return;
          }

          // Respons error tetap berbentuk blob karena responseType = "blob"
          let detail = `Server mengembalikan status ${xhr.status}`;
          try {
            const text = await (xhr.response as Blob).text();
            const parsed = JSON.parse(text);
            if (parsed?.detail) detail = parsed.detail;
          } catch {
            // Biarkan pesan default
          }
          reject(new Error(detail));
        });

        xhr.addEventListener("error", () => {
          clearServerTimer();
          reject(new Error("Gagal terhubung ke server konversi."));
        });
        xhr.addEventListener("abort", () => {
          clearServerTimer();
          reject(new Error("__cancelled__"));
        });

        xhr.open("POST", endpoint);
        xhr.responseType = "blob";
        xhr.send(formData);
      }),
    [clearServerTimer, startServerTicker]
  );

  /** Mengirim FormData dan mengembalikan teks respons, dengan progres unggahan. */
  const uploadJobRequest = useCallback(
    (endpoint: string, formData: FormData) =>
      new Promise<{ status: number; text: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;
          // Unggahan dianggap 40% pertama; sisanya milik proses di server
          setProgress(Math.round((event.loaded / event.total) * 40));
          setStatusMessage("Mengunggah berkas");
        });

        xhr.upload.addEventListener("load", () => {
          setProgress(40);
          setStatusMessage("Unggahan selesai, mendaftarkan job");
        });

        xhr.addEventListener("load", () =>
          resolve({ status: xhr.status, text: xhr.responseText })
        );
        xhr.addEventListener("error", () =>
          reject(new Error("Gagal terhubung ke server konversi."))
        );
        xhr.addEventListener("abort", () => reject(new Error("__cancelled__")));

        xhr.open("POST", endpoint);
        xhr.send(formData);
      }),
    []
  );

  const waitForJob = useCallback(async (jobId: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        if (cancelledRef.current) {
          reject(new Error("__cancelled__"));
          return;
        }

        try {
          const response = await fetch(convertJobUrl(jobId));
          if (!response.ok) throw new Error("Job tidak ditemukan di server");

          const job: ConvertJob = await response.json();
          setProgress(Math.max(40, job.progress));
          setStatusMessage(job.message || "Memproses");

          if (job.status === "done") {
            const resultResponse = await fetch(convertJobResultUrl(jobId));
            if (!resultResponse.ok) throw new Error("Gagal mengunduh hasil konversi");

            const blob = await resultResponse.blob();
            publishResult(
              blob,
              fileNameFromDisposition(
                resultResponse.headers.get("Content-Disposition"),
                job.filename || "hasil-konversi"
              )
            );
            resolve();
            return;
          }

          if (job.status === "error") {
            reject(new Error(job.error || "Konversi gagal di server"));
            return;
          }

          if (job.status === "cancelled") {
            reject(new Error("__cancelled__"));
            return;
          }

          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Gagal memantau status job"));
        }
      };

      poll();
    });
  }, [publishResult]);

  const convert = useCallback(
    async ({ endpoint, formData, background = false }: RunOptions) => {
      cancelledRef.current = false;
      jobIdRef.current = null;
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setResult(null);
      setStatusMessage("Mempersiapkan berkas");

      formData.set("mode", background ? "async" : "sync");

      try {
        if (background) {
          const { status, text } = await uploadJobRequest(endpoint, formData);

          let payload: unknown = null;
          try {
            payload = JSON.parse(text);
          } catch {
            // Respons non-JSON ditangani lewat pemeriksaan status di bawah
          }

          if (status < 200 || status >= 300) {
            const detail = (payload as { detail?: string } | null)?.detail;
            throw new Error(detail || `Server mengembalikan status ${status}`);
          }

          const job = payload as ConvertJob;
          jobIdRef.current = job.job_id;
          setProgress(40);
          setStatusMessage("Antrian konversi dimulai");
          await waitForJob(job.job_id);
        } else {
          const { blob, fileName } = await uploadSync(endpoint, formData);
          publishResult(blob, fileName);
        }

        setProgress(100);
        setStatusMessage("Selesai");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Terjadi kesalahan";
        if (message !== "__cancelled__") {
          setError(message);
        }
      } finally {
        clearPollTimer();
        clearServerTimer();
        xhrRef.current = null;
        setIsProcessing(false);
      }
    },
    [clearServerTimer, publishResult, uploadJobRequest, uploadSync, waitForJob]
  );

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    clearPollTimer();
    clearServerTimer();

    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }

    // Job async harus dihentikan di server, bukan hanya di browser
    if (jobIdRef.current) {
      try {
        await fetch(convertJobUrl(jobIdRef.current), { method: "DELETE" });
      } catch {
        // Job akan kedaluwarsa sendiri kalau permintaan batal gagal
      }
      jobIdRef.current = null;
    }

    setIsProcessing(false);
    setProgress(0);
    setStatusMessage("Dibatalkan");
  }, [clearServerTimer]);

  const reset = useCallback(() => {
    clearPollTimer();
    clearServerTimer();
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
    setError(null);
    setProgress(0);
    setStatusMessage("");
    setIsProcessing(false);
  }, [clearServerTimer]);

  return { convert, cancel, reset, isProcessing, progress, statusMessage, error, result };
}
