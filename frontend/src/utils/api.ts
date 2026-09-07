// API Configuration
// Mengambil URL dasar dari environment variable atau default ke localhost:8000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Endpoint untuk kompresi PDF yang sudah ada sebelumnya
  compress: `${API_BASE_URL}/api/v1/compress`,

  // Endpoint baru untuk konversi dokumen dan gambar sesuai spesifikasi API
  convertDocx: `${API_BASE_URL}/api/v1/convert-docx`,
  convertPpt: `${API_BASE_URL}/api/v1/convert-ppt`,
  convertImage: `${API_BASE_URL}/api/v1/convert-image`,
  removeBg: `${API_BASE_URL}/api/v1/remove-bg`,

  // Endpoint konversi universal (batch, banyak format, mendukung job async)
  convertFormats: `${API_BASE_URL}/api/v1/convert/formats`,
  convertToPdf: `${API_BASE_URL}/api/v1/convert/to-pdf`,
  convertFromPdf: `${API_BASE_URL}/api/v1/convert/from-pdf`,
  convertUrlToPdf: `${API_BASE_URL}/api/v1/convert/url-to-pdf`,

  // Endpoint proteksi PDF (pasang dan lepas kata sandi)
  securityInspect: `${API_BASE_URL}/api/v1/security/inspect`,
  securityUnlock: `${API_BASE_URL}/api/v1/security/unlock`,
  securityProtect: `${API_BASE_URL}/api/v1/security/protect`,
} as const;

/** URL status satu job konversi async */
export function convertJobUrl(jobId: string): string {
  return `${API_BASE_URL}/api/v1/convert/jobs/${jobId}`;
}

/** URL unduhan hasil job konversi async */
export function convertJobResultUrl(jobId: string): string {
  return `${API_BASE_URL}/api/v1/convert/jobs/${jobId}/result`;
}

export type ConvertJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface ConvertJob {
  job_id: string;
  name: string;
  status: ConvertJobStatus;
  progress: number;
  message: string;
  error: string | null;
  filename: string | null;
}

// Tipe data untuk kualitas kompresi
export type CompressionQuality = 'low' | 'medium' | 'high';

/**
 * Memetakan level kompresi (0-1) ke string kualitas yang dikenali oleh backend
 * @param level - Angka antara 0 hingga 1
 */
export function mapCompressionLevelToQuality(level: number): 'low' | 'medium' | 'high' {
  if (level <= 0.5) {
    return 'low';
  } else if (level <= 0.7) {
    return 'medium';
  } else {
    return 'high';
  }
}
