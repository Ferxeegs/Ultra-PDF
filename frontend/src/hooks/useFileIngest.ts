import { useCallback, useRef, useState } from "react";
import { indexedDBManager } from "@/utils/indexedDB";

/** Status satu berkas selama proses unggah ke penyimpanan browser. */
export type IngestStatus = "pending" | "uploading" | "done" | "error";

export interface IngestItem {
  /** ID yang dipakai saat menyimpan ke IndexedDB */
  id: string;
  name: string;
  size: number;
  status: IngestStatus;
  /** Persentase berkas ini, 0-100 */
  percent: number;
}

export interface IngestState {
  items: IngestItem[];
  /** Persentase gabungan seluruh berkas berdasarkan bobot ukuran, 0-100 */
  percent: number;
  /** Total byte yang sudah diproses */
  loadedBytes: number;
  /** Total byte seluruh berkas */
  totalBytes: number;
  /** Byte per detik, dihitung dari waktu mulai */
  speed: number;
  /** Perkiraan sisa detik; 0 bila belum bisa dihitung */
  eta: number;
  /** Nama berkas yang sedang diproses */
  currentName: string;
}

const EMPTY_STATE: IngestState = {
  items: [],
  percent: 0,
  loadedBytes: 0,
  totalBytes: 0,
  speed: 0,
  eta: 0,
  currentName: "",
};

/** Membuat ID unik yang stabil untuk satu berkas dalam satu sesi. */
function createFileId(file: File, index: number): string {
  return `${file.name}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Hook unggah berkas ke penyimpanan browser (IndexedDB) dengan progres nyata.
 *
 * Progres dihitung dari byte yang sudah dibaca, bukan dari jumlah berkas, agar
 * satu berkas 200 MB tidak melompat dari 0% ke 100% tanpa kabar apa pun.
 */
export function useFileIngest() {
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState<IngestState>(EMPTY_STATE);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setIsUploading(false);
    setState(EMPTY_STATE);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setIsUploading(false);
    setState(EMPTY_STATE);
  }, []);

  /**
   * Menyimpan seluruh berkas ke IndexedDB satu per satu.
   *
   * Mengembalikan daftar { id, file } sesuai urutan masukan agar pemanggil bisa
   * menulis metadata ke sessionStorage seperti sebelumnya.
   */
  const ingest = useCallback(
    async (files: File[]): Promise<Array<{ id: string; file: File }>> => {
      cancelledRef.current = false;

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const items: IngestItem[] = files.map((file, index) => ({
        id: createFileId(file, index),
        name: file.name,
        size: file.size,
        status: "pending",
        percent: 0,
      }));

      setIsUploading(true);
      setState({
        ...EMPTY_STATE,
        items,
        totalBytes,
        currentName: files[0]?.name ?? "",
      });

      const startedAt = Date.now();
      const saved: Array<{ id: string; file: File }> = [];
      let bytesBefore = 0;

      // Perbarui state gabungan tanpa menghitung ulang seluruh daftar
      const publish = (index: number, ratio: number, status: IngestStatus) => {
        const file = files[index];
        const loadedBytes = bytesBefore + file.size * ratio;
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const speed = elapsedSeconds > 0.2 ? loadedBytes / elapsedSeconds : 0;
        const remaining = totalBytes - loadedBytes;

        setState((previous) => ({
          items: previous.items.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, status, percent: Math.round(ratio * 100) }
              : item
          ),
          percent: totalBytes > 0 ? Math.min(100, (loadedBytes / totalBytes) * 100) : 100,
          loadedBytes,
          totalBytes,
          speed,
          eta: speed > 0 && remaining > 0 ? remaining / speed : 0,
          currentName: file.name,
        }));
      };

      try {
        for (let index = 0; index < files.length; index += 1) {
          if (cancelledRef.current) throw new Error("__cancelled__");

          const file = files[index];
          publish(index, 0, "uploading");

          await indexedDBManager.saveFile(items[index].id, file, (ratio) => {
            if (cancelledRef.current) return;
            publish(index, ratio, "uploading");
          });

          bytesBefore += file.size;
          publish(index, 1, "done");
          saved.push({ id: items[index].id, file });
        }

        setState((previous) => ({ ...previous, percent: 100, eta: 0 }));
        return saved;
      } catch (error) {
        // Tandai berkas yang belum selesai sebagai gagal agar terlihat di UI
        setState((previous) => ({
          ...previous,
          items: previous.items.map((item) =>
            item.status === "done" ? item : { ...item, status: "error" }
          ),
        }));
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return { ingest, reset, cancel, isUploading, ...state };
}
