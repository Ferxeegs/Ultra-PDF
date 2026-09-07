/**
 * Utilitas membaca berkas dengan laporan progres per byte.
 *
 * Berbeda dengan `file.arrayBuffer()` yang bersifat "semua atau tidak sama
 * sekali", pembacaan di sini dilakukan per potongan sehingga UI bisa
 * menampilkan persentase yang sebenarnya, bukan animasi tebakan.
 */

/** Dipanggil setiap ada kemajuan pembacaan; `loaded` dan `total` dalam byte. */
export type ProgressCallback = (loaded: number, total: number) => void;

/** Potongan 4 MB: cukup besar agar cepat, cukup kecil agar progres terasa halus. */
const CHUNK_SIZE = 4 * 1024 * 1024;

/**
 * Membaca File/Blob menjadi ArrayBuffer sambil melaporkan progres.
 *
 * Memakai Streams API bila tersedia, dan jatuh ke pembacaan per irisan
 * (`Blob.slice`) untuk browser lama. Keduanya memberi progres nyata.
 */
export async function readFileWithProgress(
  file: Blob,
  onProgress?: ProgressCallback
): Promise<ArrayBuffer> {
  const total = file.size;

  // Berkas kosong tidak punya progres yang berarti
  if (total === 0) {
    onProgress?.(0, 0);
    return new ArrayBuffer(0);
  }

  if (typeof file.stream === "function") {
    const reader = file.stream().getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }

    // Gabungkan semua potongan menjadi satu buffer berurutan
    const merged = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer as ArrayBuffer;
  }

  // Fallback: baca per irisan blob
  const merged = new Uint8Array(total);
  let offset = 0;

  while (offset < total) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, total));
    const buffer = await slice.arrayBuffer();
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
    onProgress?.(offset, total);
  }

  return merged.buffer as ArrayBuffer;
}

/** Format ukuran byte menjadi teks yang mudah dibaca manusia. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Format kecepatan transfer (byte per detik). */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "";
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** Format sisa waktu dalam detik menjadi teks singkat berbahasa Indonesia. */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)} detik lagi`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.ceil(seconds % 60);
  return rest > 0 ? `${minutes} menit ${rest} detik lagi` : `${minutes} menit lagi`;
}
