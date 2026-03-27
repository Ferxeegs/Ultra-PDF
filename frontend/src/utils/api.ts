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
} as const;

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