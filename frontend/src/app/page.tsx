"use client";

import Link from "next/link";
import {
  FileText,
  Scissors,
  FileCode,
  Presentation,
  Image as ImageIcon,
  Grid3x3,
  PenTool,
  Zap,
  ShieldCheck,
  Lock,
  MousePointer2,
  ArrowRight,
  Sparkles,
  Infinity,
  Eraser
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
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      hoverBg: "bg-blue-100 dark:bg-blue-900/50",
    },
    {
      name: "Word to PDF",
      desc: "Ubah dokumen Microsoft Word (.docx) menjadi file PDF berkualitas tinggi.",
      href: "/docx-to-pdf",
      icon: FileCode,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      hoverBg: "bg-indigo-100 dark:bg-indigo-900/50",
      isNew: true,
    },
    {
      name: "PowerPoint to PDF",
      desc: "Ubah presentasi PowerPoint (.ppt, .pptx) menjadi file PDF dengan font terjaga.",
      href: "/ppt-to-pdf",
      icon: Presentation,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/30",
      hoverBg: "bg-orange-100 dark:bg-orange-900/50",
      isNew: true,
    },
    {
      name: "Image to PDF",
      desc: "Ubah foto JPG, PNG, atau WEBP menjadi dokumen PDF dalam hitungan detik.",
      href: "/image-to-pdf",
      icon: ImageIcon,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      hoverBg: "bg-emerald-100 dark:bg-emerald-900/50",
      isNew: true,
    },
    {
      name: "Remove Background",
      desc: "Hapus background gambar otomatis dan unduh hasil PNG transparan untuk desain atau produk.",
      href: "/remove-bg",
      icon: Eraser,
      color: "text-fuchsia-600 dark:text-fuchsia-400",
      bg: "bg-fuchsia-50 dark:bg-fuchsia-900/30",
      hoverBg: "bg-fuchsia-100 dark:bg-fuchsia-900/50",
      isNew: true,
    },
    {
      name: "Split PDF",
      desc: "Pisahkan satu file PDF menjadi beberapa dokumen atau ekstrak halaman tertentu.",
      href: "/split",
      icon: Scissors,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/30",
      hoverBg: "bg-rose-100 dark:bg-rose-900/50",
    },
    {
      name: "Compress PDF",
      desc: "Kecilkan ukuran file PDF Anda tanpa mengurangi kualitas dokumen secara signifikan.",
      href: "/compress",
      icon: Zap,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      hoverBg: "bg-amber-100 dark:bg-amber-900/50",
    },
    {
      name: "Organize PDF",
      desc: "Hapus, putar, atau atur ulang urutan halaman dalam file PDF Anda.",
      href: "/organize",
      icon: Grid3x3,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/30",
      hoverBg: "bg-purple-100 dark:bg-purple-900/50",
    },
    {
      name: "Sign PDF",
      desc: "Tambahkan tanda tangan digital atau tulis tangan langsung ke dokumen PDF.",
      href: "/sign",
      icon: PenTool,
      color: "text-slate-700 dark:text-slate-300",
      bg: "bg-slate-100 dark:bg-slate-800",
      hoverBg: "bg-slate-200 dark:bg-slate-700",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FDFDFF] via-blue-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 relative overflow-hidden">
      {/* Enhanced Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] bg-blue-200/40 dark:bg-blue-900/30 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-[15%] -right-[5%] w-[40%] h-[40%] bg-indigo-200/40 dark:bg-indigo-900/30 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div className="absolute bottom-[10%] left-[20%] w-[35%] h-[35%] bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-[100px] animate-pulse delay-2000" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16 lg:py-20">
        {/* Hero Section */}
        <header className="text-center mb-12 sm:mb-16 md:mb-20 px-2">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-5 sm:mb-6 shadow-sm backdrop-blur-sm">
            <ShieldCheck size={12} className="sm:w-[14px] sm:h-[14px]" />
            <span>Secure & Local Processing</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4 sm:mb-5 leading-[1.1] sm:leading-tight">
            Solusi <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">PDF</span> Lengkap
          </h1>
          
          <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            Semua alat yang Anda butuhkan untuk mengelola PDF dalam satu tempat.
            <span className="block sm:inline sm:ml-1 mt-1 sm:mt-0 text-slate-500 dark:text-slate-400">
              Cepat, aman, dan diproses langsung di browser Anda.
            </span>
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-10 px-2">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400">
              <Infinity size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold sm:font-bold whitespace-nowrap">Tanpa Batas</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400">
              <Lock size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold sm:font-bold whitespace-nowrap">100% Privat</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400">
              <Sparkles size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold sm:font-bold whitespace-nowrap">Gratis</span>
            </div>
          </div>
        </header>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-16 sm:mb-20">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.name}
                href={tool.href}
                className="group relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-2xl hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-500 overflow-hidden"
              >
                {/* Gradient Border on Hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:via-indigo-500/20 group-hover:to-purple-500/20 transition-all duration-500 -z-10 blur-xl" />
                
                {/* Background Hover Effect */}
                <div className={`absolute top-0 right-0 w-40 h-40 -mr-10 -mt-10 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-3xl ${tool.bg}`} />

                <div className="relative z-10">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 ${tool.bg} rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${tool.color} transition-transform group-hover:scale-110`} />
                  </div>

                  <div className="flex items-start gap-2 mb-2 sm:mb-3">
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight flex-1">
                      {tool.name}
                    </h3>
                    {tool.isNew && (
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-[9px] sm:text-[10px] font-black text-white uppercase tracking-tighter shadow-sm flex-shrink-0">
                        New
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4 sm:mb-5 line-clamp-3">
                    {tool.desc}
                  </p>

                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:gap-2 sm:group-hover:gap-3 transition-all">
                    <span>Mulai Sekarang</span>
                    <ArrowRight size={14} className="sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Feature Highlights Section */}
        <div className="mt-16 sm:mt-24 md:mt-32 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 md:gap-12 border-t border-slate-200/60 dark:border-slate-800/60 pt-12 sm:pt-16 md:pt-20 px-2">
          <div className="flex flex-col items-center text-center group">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-lg border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 sm:mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Lock size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h4 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">Privasi Tanpa Kompromi</h4>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
              File Anda tidak pernah meninggalkan perangkat. Semua konversi dilakukan secara lokal di browser.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 shadow-lg border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 sm:mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Zap size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h4 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">Kecepatan Maksimal</h4>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
              Tanpa antrean server. Manfaatkan kekuatan hardware Anda untuk proses instan tanpa batas.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-lg border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 sm:mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <MousePointer2 size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h4 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">Antarmuka Modern</h4>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
              Desain intuitif dan modern yang memudahkan siapa saja untuk mengelola dokumen PDF dengan mudah.
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}