"use client";

import { useState } from "react";
import { Crop, Wand2, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

type Mode = "auto" | "manual";

export default function CropPdfPage() {
  const [mode, setMode] = useState<Mode>("auto");
  const [paddingMm, setPaddingMm] = useState(5);
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [pages, setPages] = useState("");

  const margin = (
    label: string,
    value: number,
    setValue: (next: number) => void
  ) => (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        {label}
      </label>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
      />
    </div>
  );

  const options = (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Cara memangkas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                id: "auto" as Mode,
                title: "Otomatis",
                desc: "Halaman disusutkan sampai pas ke isinya, margin kosong dibuang.",
              },
              {
                id: "manual" as Mode,
                title: "Ukuran sendiri",
                desc: "Tentukan sendiri berapa milimeter yang dipotong tiap sisi.",
              },
            ]
          ).map((choice) => (
            <button
              key={choice.id}
              onClick={() => setMode(choice.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                mode === choice.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500"
                  : "border-slate-200 dark:border-slate-600 hover:border-indigo-300"
              }`}
            >
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {choice.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {choice.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {mode === "auto" ? (
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Sisa margin:{" "}
            <span className="text-indigo-600 dark:text-indigo-400">{paddingMm} mm</span>
          </label>
          <input
            type="range"
            min={0}
            max={30}
            value={paddingMm}
            onChange={(event) => setPaddingMm(Number(event.target.value))}
            className="w-full accent-indigo-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Napas yang disisakan di sekeliling isi supaya tidak terlihat mepet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {margin("Atas (mm)", top, setTop)}
          {margin("Bawah (mm)", bottom, setBottom)}
          {margin("Kiri (mm)", left, setLeft)}
          {margin("Kanan (mm)", right, setRight)}
        </div>
      )}

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
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="Pangkas "
      titleAccent="PDF"
      description="Buang margin kosong di sekeliling halaman, otomatis mengikuti isi atau menurut ukuran yang Anda tentukan."
      accent="indigo"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Pangkas Halaman"
      endpoint={API_ENDPOINTS.toolsCrop}
      options={options}
      buildFormData={(files) => {
        if (mode === "manual" && top + bottom + left + right <= 0) {
          throw new Error("Isi minimal satu margin yang lebih besar dari nol");
        }

        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("mode", mode);
        formData.append("padding_mm", String(paddingMm));
        formData.append("top_mm", String(top));
        formData.append("bottom_mm", String(bottom));
        formData.append("left_mm", String(left));
        formData.append("right_mm", String(right));
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Wand2,
          title: "Deteksi Otomatis",
          desc: "Teks, gambar, dan grafik vektor dihitung untuk menemukan batas isi.",
        },
        {
          icon: Crop,
          title: "Isi Tetap Utuh",
          desc: "Yang diubah hanya area tampil, tidak ada isi halaman yang dihapus.",
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
