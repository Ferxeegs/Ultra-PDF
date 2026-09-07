import { useState, useCallback, useRef } from "react";
import { API_ENDPOINTS } from "@/utils/api";

interface ConvertOptions {
    type: 'docx' | 'ppt' | 'image';
}

export function useConvertWorker() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState<string>("");
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

    /**
     * Setelah unggahan selesai, server masih bekerja tanpa mengirim progres.
     * Bar digerakkan pelan dari 90% ke 99% supaya user tahu proses belum macet.
     */
    const startServerTicker = useCallback(() => {
        stopServerTicker();
        let current = 90;
        serverTimerRef.current = setInterval(() => {
            current = Math.min(99, current + 0.3);
            setProgress(current);
            if (current >= 99) stopServerTicker();
        }, 200);
    }, [stopServerTicker]);

    const convertFile = useCallback(async (
        files: File | File[],
        options: ConvertOptions
    ) => {
        setIsProcessing(true);
        setProgress(0);
        setDownloadUrl(null);
        setError(null);
        setProgressMessage("Mempersiapkan data...");

        try {
            const formData = new FormData();
            const isDocx = options.type === 'docx';
            const isPpt = options.type === 'ppt';
            const isImage = options.type === 'image';
            
            let endpoint: string;
            if (isDocx) {
                endpoint = API_ENDPOINTS.convertDocx;
            } else if (isPpt) {
                endpoint = API_ENDPOINTS.convertPpt;
            } else {
                endpoint = API_ENDPOINTS.convertImage;
            }

            if ((isDocx || isPpt) && !Array.isArray(files)) {
                // Docx/PPT biasanya hanya satu file
                formData.append("file", files);
                setProgressMessage(isPpt ? "Mengupload presentasi..." : "Mengupload dokumen...");
            } else if (isImage && Array.isArray(files)) {
                // UNTUK IMAGE: Coba gunakan key "files" jika "file" hanya terbaca satu
                // Jika backend kamu kaku menggunakan "file", ganti kembali ke "file"
                files.forEach((f) => {
                    formData.append("files", f); // Seringkali backend mengharapkan 'files' untuk array
                });
                setProgressMessage(`Mengupload ${files.length} gambar...`);
            }

            const response = await new Promise<Blob>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhrRef.current = xhr;

                xhr.upload.addEventListener("progress", (event) => {
                    if (!event.lengthComputable) return;

                    // Unggahan mengisi 0-90%; sisanya untuk pemrosesan di server
                    const uploadProgress = Math.round((event.loaded / event.total) * 90);
                    setProgress(uploadProgress);
                    setProgressMessage(
                        uploadProgress >= 90 ? "Unggahan selesai, menunggu server..." : "Mengupload file ke server..."
                    );
                });

                // Seluruh berkas sudah terkirim: masuk fase pemrosesan server
                xhr.upload.addEventListener("load", () => {
                    setProgressMessage("Server sedang memproses file...");
                    startServerTicker();
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`Server Error: ${xhr.status}. Backend mungkin tidak mendukung banyak file.`));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Gagal terhubung ke server backend.")));
                xhr.addEventListener("abort", () => reject(new Error("__cancelled__")));
                xhr.open("POST", endpoint);
                xhr.responseType = "blob";
                xhr.send(formData);
            });

            stopServerTicker();
            setProgress(100);
            setProgressMessage("Konversi selesai! File siap diunduh.");
            setDownloadUrl(URL.createObjectURL(response));
            setIsProcessing(false);

        } catch (err) {
            stopServerTicker();
            setProgress(0);
            setProgressMessage("");
            setIsProcessing(false);

            // Pembatalan oleh user bukan kesalahan yang perlu ditampilkan
            const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
            if (message !== "__cancelled__") {
                console.error(err);
                setError(message);
            }
        }
    }, [startServerTicker, stopServerTicker]);

    const reset = useCallback(() => {
        stopServerTicker();
        if (xhrRef.current) {
            xhrRef.current.abort();
            xhrRef.current = null;
        }
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
        setProgress(0);
        setProgressMessage("");
        setIsProcessing(false);
        setError(null);
    }, [downloadUrl, stopServerTicker]);

    return { isProcessing, progress, progressMessage, downloadUrl, error, convertFile, reset };
}