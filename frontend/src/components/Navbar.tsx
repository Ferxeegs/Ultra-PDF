"use client";

import { useState } from "react";
import { FileText, Menu, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    {
      name: "Merge PDF",
      href: "/",
      icon: FileText,
    },
    {
      name: "Compress PDF",
      href: "/compress",
      icon: Zap,
    },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-600 rounded-lg blur-md opacity-20 group-hover:opacity-30 transition-opacity" />
              <Image src="/favicon.ico" alt="UltraPDF" width={60} height={60} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-900 leading-tight">
                Ultra<span className="text-blue-600">PDF</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
                PDF Tools
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
                    transition-all duration-200
                    ${
                      isActive
                        ? "text-blue-600 bg-blue-50 shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? "text-blue-600" : ""} />
                  <span>{item.name}</span>
                  {/* {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
                  )} */}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X size={24} />
            ) : (
              <Menu size={24} />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-slate-200 mt-2 pt-4">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm
                      transition-all duration-200
                      ${
                        isActive
                          ? "text-blue-600 bg-blue-50 shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }
                    `}
                  >
                    <Icon size={20} className={isActive ? "text-blue-600" : ""} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

