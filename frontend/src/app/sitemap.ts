import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://ultrapdf.my.id'

  // Tambahkan path fitur-fitur baru Anda di sini
  const routes = [
    '',
    '/convert',
    '/image-converter',
    '/merge',
    '/split',
    '/compress',
    '/sign',
    '/organize',
    '/docx-to-pdf',
    '/pdf-to-word',
    '/pdf-to-excel',
    '/pdf-to-jpg',
    '/jpg-to-pdf',
    '/unlock-pdf',
    '/protect-pdf',
    '/ppt-to-pdf',
    '/image-to-pdf',
    '/remove-bg',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return routes
}