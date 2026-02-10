"use client";

import Link from "next/link";
import {
  FileText,
  Scissors,
  FileCode,
  Image as ImageIcon,
  Grid3x3,
  PenTool,
  Zap,
  ShieldCheck,
  Lock,
  MousePointer2,
  ArrowRight
} from "lucide-react";
import Footer from "@/components/Footer";

export default function Home() {
  // Daftar semua fitur UltraPDF
  const tools = [
    {
      name: "Merge PDF",
      desc: "Gabungkan beberapa file PDF menjadi satu dokumen dengan urutan sesuai keinginan.",
      href: "/merge",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      name: "Word to PDF",
      desc: "Ubah dokumen Microsoft Word (.docx) menjadi file PDF berkualitas tinggi.",
      href: "/docx-to-pdf",
      icon: FileCode,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      isNew: true, // Badge NEW
    },
    {
      name: "Image to PDF",
      desc: "Ubah foto JPG, PNG, atau WEBP menjadi dokumen PDF dalam hitungan detik.",
      href: "/image-to-pdf",
      icon: ImageIcon,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      isNew: true, // Badge NEW
    },
    {
      name: "Split PDF",
      desc: "Pisahkan satu file PDF menjadi beberapa dokumen atau ekstrak halaman tertentu.",
      href: "/split",
      icon: Scissors,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-900/30",
    },
    {
      name: "Compress PDF",
      desc: "Kecilkan ukuran file PDF Anda tanpa mengurangi kualitas dokumen secara signifikan.",
      href: "/compress",
      icon: Zap,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      name: "Organize PDF",
      desc: "Hapus, putar, atau atur ulang urutan halaman dalam file PDF Anda.",
      href: "/organize",
      icon: Grid3x3,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/30",
    },
    {
      name: "Sign PDF",
      desc: "Tambahkan tanda tangan digital atau tulis tangan langsung ke dokumen PDF.",
      href: "/sign",
      icon: PenTool,
      color: "text-slate-700",
      bg: "bg-slate-100 dark:bg-slate-800",
    },
  ];

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-100/40 dark:bg-indigo-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <ShieldCheck size={14} />
            <span>Secure & Local Processing</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-6">
            Solusi <span className="text-blue-600 dark:text-blue-400">PDF</span> Lengkap
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-2xl mx-auto">
            Semua alat yang Anda butuhkan untuk mengelola PDF dalam satu tempat.
            Cepat, aman, dan diproses langsung di browser Anda.
          </p>
        </header>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.name}
                href={tool.href}
                className="group relative bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Background Hover Effect */}
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-3xl ${tool.bg}`} />

                <div className="relative z-10">
                  <div className={`w-14 h-14 ${tool.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-7 h-7 ${tool.color}`} />
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {tool.name}
                    </h3>
                    {tool.isNew && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-black text-white uppercase tracking-tighter">
                        New
                      </span>
                    )}
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                    {tool.desc}
                  </p>

                  <div className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:gap-4 transition-all">
                    Mulai Sekarang <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Feature Highlights Section */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-12 border-t border-slate-100 dark:border-slate-800 pt-16">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 mb-6">
              <Lock size={24} />
            </div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Privasi Tanpa Kompromi</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">File Anda tidak pernah meninggalkan perangkat. Semua konversi dilakukan secara lokal.</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 mb-6">
              <Zap size={24} />
            </div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Kecepatan Maksimal</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tanpa antrean server. Manfaatkan kekuatan hardware Anda untuk proses instan.</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-500 mb-6">
              <MousePointer2 size={24} />
            </div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Antarmuka Modern</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">Desain intuitif yang memudahkan siapa saja untuk mengelola dokumen PDF.</p>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}