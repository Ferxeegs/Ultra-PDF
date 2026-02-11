"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Menu,
  X,
  Zap,
  Sun,
  Moon,
  Scissors,
  Settings,
  Grid3x3,
  PenTool,
  FileCode,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: "Merge", href: "/merge", icon: FileText },
    { name: "Split", href: "/split", icon: Scissors },
    { name: "Word to PDF", href: "/docx-to-pdf", icon: FileCode },
    { name: "Image to PDF", href: "/image-to-pdf", icon: ImageIcon },
    { name: "Organize", href: "/organize", icon: Grid3x3 },
    { name: "Sign", href: "/sign", icon: PenTool },
    { name: "Compress", href: "/compress", icon: Zap },
    { name: "Settings", href: "/settings", icon: Settings },
    // Kamu bisa tambah 10 fitur lagi di sini dan Navbar tidak akan pecah
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60">
      <div className="max-w-[1440px] mx-auto px-4">
        <div className="flex items-center h-20 gap-4">

          {/* 1. LOGO - Tetap di kiri, tidak mengecil */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-9 h-9 transition-transform group-hover:scale-110">
              <div className="absolute inset-0 bg-blue-600 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <Image
                src="/icons/ultrapdf-ic.png"
                alt="Logo"
                width={36}
                height={36}
                className="relative object-contain"
              />
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none tracking-tighter">
                Ultra<span className="text-blue-600 dark:text-blue-400">PDF</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-[0.1em] uppercase mt-0.5">
                Digital Tools
              </span>
            </div>
          </Link>

          {/* 2. SCALABLE NAVIGATION - Bagian tengah yang bisa bergeser */}
          <div className="hidden xl:flex flex-1 min-w-0 relative items-center group/nav">
            {/* Masking Gradient (Kiri) */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 pointer-events-none opacity-0 group-hover/nav:opacity-100 transition-opacity" />

            <div
              ref={scrollContainerRef}
              className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-xl whitespace-nowrap
                      ${isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                      }
                    `}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Masking Gradient (Kanan) */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10 pointer-events-none opacity-0 group-hover/nav:opacity-100 transition-opacity" />
          </div>

          {/* 3. ACTIONS - Tombol tema dan mobile toggle */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="group relative p-2.5 rounded-xl transition-all duration-300 bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-blue-200 dark:hover:border-slate-600"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun size={20} className="text-amber-500 transition-all group-hover:rotate-45" />
                ) : (
                  <Moon size={20} className="text-slate-600 transition-all group-hover:-rotate-12" />
                )
              ) : (
                <div className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* MOBILE DROPDOWN */}
        {isMobileMenuOpen && (
          <div className="xl:hidden py-4 pb-6 space-y-1.5 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300 max-h-[80vh] overflow-y-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-bold
                    ${isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }
                  `}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* CSS internal untuk sembunyikan scrollbar */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </nav>
  );
}