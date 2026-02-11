import { useState, useCallback, useRef } from "react";
import { API_ENDPOINTS } from "@/utils/api";

interface ConvertOptions {
    type: 'docx' | 'image';
}

export function useConvertWorker() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState<string>("");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const xhrRef = useRef<XMLHttpRequest | null>(null);

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
            const endpoint = isDocx ? API_ENDPOINTS.convertDocx : API_ENDPOINTS.convertImage;

            if (isDocx && !Array.isArray(files)) {
                // Docx biasanya hanya satu file
                formData.append("file", files);
                setProgressMessage("Mengupload dokumen...");
            } else if (!isDocx && Array.isArray(files)) {
                // UNTUK IMAGE: Coba gunakan key "files" jika "file" hanya terbaca satu
                // Jika backend kamu kaku menggunakan "file", ganti kembali ke "file"
                files.forEach((f) => {
                    formData.append("files", f); // Seringkali backend mengharapkan 'files' untuk array
                });
                setProgressMessage(`Mengupload ${files.length} gambar...`);
            }

            // DEBUG: Cek isi FormData di console
            for (let pair of formData.entries()) {
                console.log("Kirim ke API:", pair[0], pair[1]);
            }

            const response = await new Promise<Blob>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhrRef.current = xhr;

                xhr.upload.addEventListener("progress", (event) => {
                    if (event.lengthComputable) {
                        const uploadProgress = Math.round((event.loaded / event.total) * 95);
                        setProgress(uploadProgress);
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`Server Error: ${xhr.status}. Backend mungkin tidak mendukung banyak file.`));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Gagal terhubung ke server backend.")));
                xhr.open("POST", endpoint);
                xhr.responseType = "blob";
                xhr.send(formData);
            });

            setProgress(100);
            setDownloadUrl(URL.createObjectURL(response));
            setIsProcessing(false);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
            setIsProcessing(false);
        }
    }, []);

    const reset = useCallback(() => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
        setProgress(0);
        setIsProcessing(false);
        setError(null);
    }, [downloadUrl]);

    return { isProcessing, progress, progressMessage, downloadUrl, error, convertFile, reset };
}