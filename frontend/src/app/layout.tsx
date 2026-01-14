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
  title: "UltraPDF - Gabungkan PDF dengan Cepat dan Mudah ",
  description: "Gabungkan dokumen PDF secara instan tanpa mengunggah file ke server. Cepat, privat, dan tanpa batas ukuran.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "UltraPDF - Gabungkan PDF dengan Cepat dan Mudah",
    description: "Gabungkan dokumen PDF secara instan tanpa mengunggah file ke server. Cepat, privat, dan tanpa batas ukuran.",
  },
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
