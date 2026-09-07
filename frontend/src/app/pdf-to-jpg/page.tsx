"use client";

import { useState } from "react";
import { Image as ImageIcon, Layers, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

type Mode = "render" | "extract";

export default function PdfToJpgPage() {
  const [mode, setMode] = useState<Mode>("render");
  const [dpi, setDpi] = useState(150);
  const [pages, setPages] = useState("");

  const options = (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Cara pengambilan gambar
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                id: "render" as Mode,
                title: "Halaman jadi JPG",
                desc: "Setiap halaman dirender utuh beserta teksnya.",
              },
              {
                id: "extract" as Mode,
                title: "Ambil gambar di dalamnya",
                desc: "Hanya foto yang tertanam di PDF, tanpa teks dan latar.",
              },
            ]
          ).map((choice) => (
            <button
              key={choice.id}
              onClick={() => setMode(choice.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                mode === choice.id
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500"
                  : "border-slate-200 dark:border-slate-600 hover:border-amber-300"
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

      {/* DPI hanya berpengaruh saat halaman dirender; gambar tertanam keluar apa adanya */}
      {mode === "render" && (
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Resolusi: <span className="text-amber-600 dark:text-amber-400">{dpi} DPI</span>
          </label>
          <input
            type="range"
            min={72}
            max={400}
            step={1}
            value={dpi}
            onChange={(event) => setDpi(Number(event.target.value))}
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Makin tinggi makin tajam, tetapi ukuran berkasnya juga makin besar.
          </p>
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
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="JPG"
      description="Ubah setiap halaman PDF menjadi JPG, atau panen semua gambar yang tertanam di dalamnya."
      accent="amber"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke JPG"
      endpoint={API_ENDPOINTS.convertFromPdf}
      note="Lebih dari satu gambar akan diunduh sebagai satu berkas ZIP."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "jpg");
        formData.append("dpi", String(dpi));
        formData.append("extract_images", mode === "extract" ? "true" : "false");
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: ImageIcon,
          title: "Kualitas Terjaga",
          desc: "Render sampai 400 DPI, cukup untuk dicetak maupun dipakai di presentasi.",
        },
        {
          icon: Layers,
          title: "Dua Cara Kerja",
          desc: "Render halaman utuh, atau ambil hanya foto asli yang ada di dalam PDF.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "PDF Anda dihapus dari server segera setelah konversi selesai.",
        },
      ]}
    />
  );
}
