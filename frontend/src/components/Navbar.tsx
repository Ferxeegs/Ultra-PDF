"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Grid3x3,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  getPrimaryNavTools,
  getToolsByCategory,
  TOOL_CATEGORIES,
  type ToolCategoryId,
} from "@/utils/toolsCatalog";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDesktopCategory, setOpenDesktopCategory] = useState<ToolCategoryId | null>(null);
  const [openMobileCategory, setOpenMobileCategory] = useState<ToolCategoryId | null>("organize");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDesktopCategory(null);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!megaRef.current?.contains(event.target as Node)) {
        setOpenDesktopCategory(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDesktopCategory(null);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const topLinks = getPrimaryNavTools().filter((tool) =>
    ["/convert", "/merge", "/split", "/compress", "/sign"].includes(tool.href)
  );

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  const categoryHasActive = (categoryId: ToolCategoryId) =>
    getToolsByCategory(categoryId).some((tool) => isActive(tool.href));

  return (
    <nav className="sticky top-0 z-50 w-full overflow-x-clip bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-700/70">
      <div ref={megaRef} className="relative max-w-[1440px] mx-auto px-4">
        <div className="flex items-center h-20 gap-3">
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-9 h-9 transition-transform group-hover:scale-105">
              <div className="absolute inset-0 bg-blue-600 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <Image
                src="/icons/ultrapdf-ic.png"
                alt="UltraPDF"
                width={36}
                height={36}
                className="relative object-contain"
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none tracking-tighter">
                Ultra<span className="text-blue-600 dark:text-blue-400">PDF</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-[0.14em] uppercase mt-0.5">
                Precision Tools
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex flex-1 items-center gap-1 min-w-0">
            {topLinks.map((tool) => {
              const Icon = tool.icon;
              const active = isActive(tool.href);
              const label =
                tool.href === "/convert"
                  ? "Convert"
                  : tool.name.replace(" PDF", "");
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-colors
                    ${active
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                    }
                  `}
                >
                  <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                </Link>
              );
            })}

            <div className="ml-1">
              <button
                type="button"
                onClick={() =>
                  setOpenDesktopCategory((prev) => (prev ? null : "organize"))
                }
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-lg transition-colors
                  ${openDesktopCategory || TOOL_CATEGORIES.some((c) => categoryHasActive(c.id))
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }
                `}
                aria-expanded={Boolean(openDesktopCategory)}
              >
                <Grid3x3 size={15} />
                Semua Alat
                <ChevronDown
                  size={14}
                  className={`transition-transform ${openDesktopCategory ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <Link
              href="/settings"
              className={`hidden md:flex p-2.5 rounded-xl transition-colors ${
                isActive("/settings")
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-200"
              }`}
              aria-label="Settings"
            >
              <Settings size={18} />
            </Link>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl transition-all duration-300 bg-slate-100 dark:bg-slate-800"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun size={18} className="text-amber-500" />
                ) : (
                  <Moon size={18} className="text-slate-600" />
                )
              ) : (
                <div className="w-[18px] h-[18px]" />
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {openDesktopCategory && (
          <div className="hidden lg:block absolute left-4 right-4 top-full z-50 mt-2 max-w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)] min-w-0">
              <div className="bg-slate-50 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700 p-3 space-y-1 min-w-0">
                {TOOL_CATEGORIES.map((category) => {
                  const selected = openDesktopCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setOpenDesktopCategory(category.id)}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-xl transition-colors
                        ${selected
                          ? "bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300"
                          : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/50"
                        }
                      `}
                    >
                      <div className="text-sm font-bold">{category.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {category.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 max-h-[min(420px,70vh)] overflow-y-auto overflow-x-hidden custom-scrollbar min-w-0">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-1.5">
                  {getToolsByCategory(openDesktopCategory).map((tool) => {
                    const Icon = tool.icon;
                    const active = isActive(tool.href);
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setOpenDesktopCategory(null)}
                        className={`
                          flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors min-w-0
                          ${active
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                          }
                        `}
                      >
                        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tool.bg}`}>
                          <Icon size={16} className={tool.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{tool.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {tool.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile / tablet menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200 max-h-[min(78vh,640px)] overflow-y-auto custom-scrollbar">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
              {topLinks.map((tool) => {
                const Icon = tool.icon;
                const active = isActive(tool.href);
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap
                      ${active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }
                    `}
                  >
                    <Icon size={14} />
                    {tool.name.replace(" PDF", "").replace(" Apa Saja", "")}
                  </Link>
                );
              })}
            </div>

            {TOOL_CATEGORIES.map((category) => {
              const expanded = openMobileCategory === category.id;
              const tools = getToolsByCategory(category.id);
              return (
                <div key={category.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMobileCategory((prev) =>
                        prev === category.id ? null : category.id
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span>{category.label}</span>
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="text-[11px] font-semibold">{tools.length}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                  {expanded && (
                    <div className="pb-2 space-y-0.5">
                      {tools.map((tool) => {
                        const Icon = tool.icon;
                        const active = isActive(tool.href);
                        return (
                          <Link
                            key={tool.href}
                            href={tool.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                              ${active
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              }
                            `}
                          >
                            <Icon size={18} />
                            {tool.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <Link
              href="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`
                mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold
                ${isActive("/settings")
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }
              `}
            >
              <Settings size={18} />
              Settings
            </Link>
          </div>
        )}
      </div>

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
