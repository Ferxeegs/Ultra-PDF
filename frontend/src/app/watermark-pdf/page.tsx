"use client";

import { useState } from "react";
import { Droplets, Palette, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

const POSITIONS = [
  { id: "diagonal", label: "Diagonal", desc: "Melintang di tengah halaman" },
  { id: "ubin", label: "Ubin", desc: "Berulang menutupi seluruh halaman" },
  { id: "tengah", label: "Tengah", desc: "Mendatar di tengah halaman" },
  { id: "atas", label: "Atas", desc: "Mendatar di tepi atas" },
  { id: "bawah", label: "Bawah", desc: "Mendatar di tepi bawah" },
] as const;

export default function WatermarkPdfPage() {
  const [text, setText] = useState("RAHASIA");
  const [position, setPosition] = useState<string>("diagonal");
  const [opacity, setOpacity] = useState(15);
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#808080");
  const [pages, setPages] = useState("");

  const options = (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Teks tanda air
        </label>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Contoh: RAHASIA"
          maxLength={80}
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Posisi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POSITIONS.map((choice) => (
            <button
              key={choice.id}
              onClick={() => setPosition(choice.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                position === choice.id
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-500"
                  : "border-slate-200 dark:border-slate-600 hover:border-sky-300"
              }`}
            >
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {choice.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {choice.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Ketebalan:{" "}
            <span className="text-sky-600 dark:text-sky-400">{opacity}%</span>
          </label>
          <input
            type="range"
            min={2}
            max={100}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="w-full accent-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Ukuran huruf:{" "}
            <span className="text-sky-600 dark:text-sky-400">{fontSize} pt</span>
          </label>
          <input
            type="range"
            min={10}
            max={150}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
            className="w-full accent-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Warna
          </label>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="w-full h-12 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Halaman
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
              (kosongkan untuk semua)
            </span>
          </label>
          <input
            type="text"
            value={pages}
            onChange={(event) => setPages(event.target.value)}
            placeholder="Contoh: 1-3,7"
            className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
          />
        </div>
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="Tanda Air "
      titleAccent="PDF"
      description="Bubuhkan tanda air teks ke seluruh halaman atau rentang halaman tertentu."
      accent="sky"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Bubuhkan Tanda Air"
      endpoint={API_ENDPOINTS.toolsWatermark}
      options={options}
      buildFormData={(files) => {
        if (!text.trim()) throw new Error("Teks tanda air tidak boleh kosong");

        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("text", text.trim());
        formData.append("position", position);
        // Backend memakai skala 0..1, sedangkan slider dalam persen
        formData.append("opacity", String(opacity / 100));
        formData.append("font_size", String(fontSize));
        formData.append("color", color);
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Droplets,
          title: "Lima Posisi",
          desc: "Diagonal, ubin berulang, tengah, atas, atau bawah halaman.",
        },
        {
          icon: Palette,
          title: "Bisa Disetel",
          desc: "Warna, ketebalan, dan ukuran huruf diatur sesuai kebutuhan.",
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
