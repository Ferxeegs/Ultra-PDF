"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Infinity,
  Lock,
  MousePointer2,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Footer from "@/components/Footer";
import { isFeatureNew } from "@/utils/featureBadge";
import {
  TOOL_CATEGORIES,
  TOOLS,
  type ToolCategoryId,
  type ToolItem,
} from "@/utils/toolsCatalog";

type FilterId = "all" | ToolCategoryId;

export default function Home() {
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      const matchCategory = activeFilter === "all" || tool.category === activeFilter;
      if (!matchCategory) return false;
      if (!normalized) return true;
      return (
        tool.name.toLowerCase().includes(normalized) ||
        tool.desc.toLowerCase().includes(normalized)
      );
    });
  }, [activeFilter, query]);

  const groupedTools = useMemo(() => {
    return TOOL_CATEGORIES.map((category) => ({
      ...category,
      tools: filteredTools.filter((tool) => tool.category === category.id),
    })).filter((group) => group.tools.length > 0);
  }, [filteredTools]);

  return (
    <main className="min-h-screen bg-[#F7F9FC] dark:bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[80%] h-[55%] bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.14),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8">
        <header className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <p className="text-xs sm:text-sm font-bold tracking-[0.22em] uppercase text-blue-600 dark:text-blue-400 mb-4">
            UltraPDF
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-[1.05] mb-5">
            Presisi untuk
            <span className="block text-blue-600 dark:text-blue-400">setiap dokumen</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto mb-7">
            Konversi, susun, dan amankan PDF dengan alur yang tenang — privat di perangkat Anda, tanpa antrean.
          </p>

          <div className="relative max-w-xl mx-auto mb-6">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari alat… misalnya merge, excel, unlock"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-11 pr-4 py-3.5 text-sm sm:text-base text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <FilterChip
              label="Semua"
              count={TOOLS.length}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            {TOOL_CATEGORIES.map((category) => (
              <FilterChip
                key={category.id}
                label={category.label}
                count={TOOLS.filter((t) => t.category === category.id).length}
                active={activeFilter === category.id}
                onClick={() => setActiveFilter(category.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400" />
              Secure & Local
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Infinity size={15} className="text-blue-600 dark:text-blue-400" />
              Tanpa batas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock size={15} className="text-blue-600 dark:text-blue-400" />
              100% privat
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
              Gratis
            </span>
          </div>
        </header>

        {groupedTools.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
            <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">
              Tidak ada alat yang cocok
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Coba kata kunci lain atau reset filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveFilter("all");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Tampilkan semua alat
            </button>
          </div>
        ) : (
          <div className="space-y-10 sm:space-y-12 mb-16 sm:mb-20">
            {groupedTools.map((group) => (
              <section key={group.id} id={group.id} className="scroll-mt-24">
                <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                      {group.label}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {group.description}
                    </p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {group.tools.length} alat
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {group.tools.map((tool) => (
                    <ToolCard key={tool.href} tool={tool} now={now} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 border-t border-slate-200/80 dark:border-slate-800 pt-12 sm:pt-16 mb-8">
          <Highlight
            icon={<Lock size={22} />}
            title="Privasi tanpa kompromi"
            text="File Anda tidak pernah meninggalkan perangkat. Proses lokal di browser."
            tone="blue"
          />
          <Highlight
            icon={<Zap size={22} />}
            title="Kecepatan maksimal"
            text="Tanpa antrean server. Manfaatkan hardware Anda untuk proses instan."
            tone="amber"
          />
          <Highlight
            icon={<MousePointer2 size={22} />}
            title="Antarmuka yang jelas"
            text="Alat dikelompokkan rapi supaya dokumen siap dikelola tanpa bingung."
            tone="slate"
          />
        </div>

        <Footer />
      </div>
    </main>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors
        ${active
          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
        }
      `}
    >
      {label}
      <span
        className={`
          text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md font-black
          ${active
            ? "bg-white/20 dark:bg-slate-900/15"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }
        `}
      >
        {count}
      </span>
    </button>
  );
}

function ToolCard({ tool, now }: { tool: ToolItem; now: number | null }) {
  const Icon = tool.icon;
  const showNew = now !== null && isFeatureNew(tool.releasedAt, now);

  return (
    <Link
      href={tool.href}
      className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`w-11 h-11 ${tool.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${tool.color}`} />
        </div>
        {showNew && (
          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-black text-white uppercase tracking-wide">
            New
          </span>
        )}
      </div>

      <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mb-1.5 leading-snug">
        {tool.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1 mb-4">
        {tool.desc}
      </p>

      <div className="flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:gap-2.5 transition-all">
        <span>Buka</span>
        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function Highlight({
  icon,
  title,
  text,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: "blue" | "amber" | "slate";
}) {
  const toneClass =
    tone === "blue"
      ? "from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50"
      : tone === "amber"
        ? "from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50"
        : "from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

  return (
    <div className="text-center sm:text-left">
      <div
        className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br border items-center justify-center mb-4 ${toneClass}`}
      >
        {icon}
      </div>
      <h4 className="text-lg font-black text-slate-900 dark:text-slate-50 mb-2">{title}</h4>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}
