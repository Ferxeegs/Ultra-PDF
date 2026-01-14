import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    //   disallow: '/private/', // Opsional: jika Anda punya folder rahasia
    },
    sitemap: 'https://ultrapdf.my.id/sitemap.xml',
  }
}