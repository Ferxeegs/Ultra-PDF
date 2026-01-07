"use client";

import { useState, useEffect } from "react";
import { FileText, Menu, X, Zap, Sun, Moon, Scissors, Settings, Grid3x3, PenTool } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: "Merge PDF", href: "/", icon: FileText },
    { name: "Split PDF", href: "/split", icon: Scissors },
    { name: "Organize PDF", href: "/organize", icon: Grid3x3 },
    { name: "Sign PDF", href: "/sign", icon: PenTool },
    { name: "Compress PDF", href: "/compress", icon: Zap },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20"> {/* Tinggi navbar dinaikkan sedikit (h-20) */}
          
          {/* GROUP KIRI: Logo + Navigasi */}
          <div className="flex items-center gap-12"> {/* Jarak besar antara logo dan menu (gap-12) */}
            
            {/* Logo - Ukuran Diperbesar */}
            <Link href="/" className="flex items-center gap-4 group">
              <div className="relative w-10 h-10 transition-transform group-hover:scale-110"> {/* Ukuran icon diperbesar ke w-10 */}
                <div className="absolute inset-0 bg-blue-600 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                <Image 
                  src="/icons/ultrapdf-ic.png" 
                  alt="Logo" 
                  width={60} 
                  height={60} 
                  className="relative object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none tracking-tighter">
                  Ultra<span className="text-blue-600 dark:text-blue-400">PDF</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">
                  Digital Tools
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Berada di samping logo dengan jarak lega */}
            <div className="hidden md:flex items-center gap-8"> {/* Jarak antar menu ditingkatkan (gap-8) */}
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
                      flex items-center gap-2.5 px-2 py-1 text-sm font-bold transition-all duration-300 relative
                      ${isActive 
                        ? "text-blue-600 dark:text-blue-400" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    {item.name}
                    {/* Indikator aktif berupa garis bawah yang elegan */}
                    {isActive && (
                      <span className="absolute -bottom-[26px] left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* GROUP KANAN: Theme Toggle */}
          <div className="hidden md:flex items-center">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="group relative p-3 rounded-2xl transition-all duration-300 bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent hover:border-amber-100 dark:hover:border-slate-600"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun size={22} className="text-amber-500 transition-all group-hover:rotate-45" />
                ) : (
                  <Moon size={22} className="text-slate-600 transition-all group-hover:-rotate-12" />
                )
              ) : (
                <div className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* MOBILE - Tombol Menu */}
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600"
            >
              {mounted && theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* MOBILE DROPDOWN */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-6 space-y-3 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
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
                    flex items-center gap-4 px-6 py-4 rounded-2xl text-base font-bold
                    ${isActive 
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none" 
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }
                  `}
                >
                  <Icon size={22} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}