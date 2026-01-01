// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  compress: `${API_BASE_URL}/api/v1/compress`,
} as const;

export type CompressionQuality = 'low' | 'medium' | 'high';

/**
 * Map compression level (0-1) to backend quality string
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

