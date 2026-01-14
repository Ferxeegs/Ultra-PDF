import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UltraPDF | Private & Secure PDF Tools",
  description: "Kelola dokumen PDF Anda sepenuhnya di browser. Gabungkan, pisah, dan tanda tangani PDF dengan keamanan maksimal tanpa unggah file ke server.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "UltraPDF | Private & Secure PDF Tools",
    description: "Kelola dokumen PDF Anda sepenuhnya di browser. Gabungkan, pisah, dan tanda tangani PDF dengan keamanan maksimal tanpa unggah file ke server.",
    url: 'https://ultrapdf.my.id',
    siteName: 'UltraPDF',
    locale: 'id_ID',
    type: 'website',
  },
  // Tambahan untuk tampilan lebih profesional di Twitter/X
  // twitter: {
  //   card: "summary_large_image",
  //   title: "UltraPDF | Private & Secure PDF Tools",
  //   description: "Edit PDF tanpa upload. Cepat, privat, dan aman.",
  //   // images: ["/og-image.png"], // Jika Anda sudah punya gambar preview
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground transition-colors duration-200`}
      >
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}