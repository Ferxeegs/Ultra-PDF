"use client";

import { useState } from "react";
import { Hash, SlidersHorizontal, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

const POSITIONS = [
  { id: "bawah-tengah", label: "Bawah tengah" },
  { id: "bawah-kanan", label: "Bawah kanan" },
  { id: "bawah-kiri", label: "Bawah kiri" },
  { id: "atas-tengah", label: "Atas tengah" },
  { id: "atas-kanan", label: "Atas kanan" },
  { id: "atas-kiri", label: "Atas kiri" },
] as const;

const TEMPLATES = [
  { id: "{n}", label: "1" },
  { id: "- {n} -", label: "- 1 -" },
  { id: "{n} / {total}", label: "1 / 10" },
  { id: "Halaman {n} dari {total}", label: "Halaman 1 dari 10" },
] as const;

export default function PageNumbersPage() {
  const [position, setPosition] = useState<string>("bawah-tengah");
  const [template, setTemplate] = useState<string>("{n}");
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [marginMm, setMarginMm] = useState(12);
  const [skipFirst, setSkipFirst] = useState(false);

  const options = (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Posisi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POSITIONS.map((choice) => (
            <button
              key={choice.id}
              onClick={() => setPosition(choice.id)}
              className={`p-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                position === choice.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-600 hover:border-emerald-300 text-slate-700 dark:text-slate-300"
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Format
        </p>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((choice) => (
            <button
              key={choice.id}
              onClick={() => setTemplate(choice.id)}
              className={`p-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                template === choice.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-600 hover:border-emerald-300 text-slate-700 dark:text-slate-300"
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Mulai dari
          </label>
          <input
            type="number"
            min={0}
            max={9999}
            value={startNumber}
            onChange={(event) => setStartNumber(Number(event.target.value))}
            className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Ukuran: <span className="text-emerald-600 dark:text-emerald-400">{fontSize} pt</span>
          </label>
          <input
            type="range"
            min={6}
            max={24}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
            className="w-full accent-emerald-500 mt-4"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Jarak tepi:{" "}
            <span className="text-emerald-600 dark:text-emerald-400">{marginMm} mm</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            value={marginMm}
            onChange={(event) => setMarginMm(Number(event.target.value))}
            className="w-full accent-emerald-500 mt-4"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer hover:border-emerald-300 transition-all">
        <input
          type="checkbox"
          checked={skipFirst}
          onChange={(event) => setSkipFirst(event.target.checked)}
          className="w-4 h-4 accent-emerald-500"
        />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Lewati halaman pertama (biasanya sampul)
        </span>
      </label>
    </div>
  );

  return (
    <ToolWorkspace
      title="Nomor "
      titleAccent="Halaman"
      description="Bubuhkan nomor halaman dengan posisi, format, dan ukuran yang bisa Anda atur."
      accent="emerald"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Bubuhkan Nomor"
      endpoint={API_ENDPOINTS.toolsPageNumbers}
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("position", position);
        formData.append("template", template);
        formData.append("start_number", String(startNumber));
        formData.append("font_size", String(fontSize));
        formData.append("margin_mm", String(marginMm));
        formData.append("skip_first", skipFirst ? "true" : "false");
        return formData;
      }}
      features={[
        {
          icon: Hash,
          title: "Empat Format",
          desc: 'Dari "1" sederhana sampai "Halaman 1 dari 10".',
        },
        {
          icon: SlidersHorizontal,
          title: "Enam Posisi",
          desc: "Atas atau bawah, rata kiri, tengah, maupun kanan.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "PDF Anda dihapus dari server segera setelah proses selesai.",
        },
      ]}
    />
  );
}
