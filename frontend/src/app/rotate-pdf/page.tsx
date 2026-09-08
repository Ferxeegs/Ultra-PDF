"use client";

import { useState } from "react";
import { RotateCw, Layers, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

const ANGLES = [
  { value: 90, label: "90°", desc: "Seperempat putaran ke kanan" },
  { value: 180, label: "180°", desc: "Terbalik, kepala jadi di bawah" },
  { value: 270, label: "270°", desc: "Seperempat putaran ke kiri" },
];

export default function RotatePdfPage() {
  const [angle, setAngle] = useState(90);
  const [pages, setPages] = useState("");

  const options = (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Sudut putar
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ANGLES.map((choice) => (
            <button
              key={choice.value}
              onClick={() => setAngle(choice.value)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                angle === choice.value
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500"
                  : "border-slate-200 dark:border-slate-600 hover:border-purple-300"
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
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="Putar "
      titleAccent="PDF"
      description="Betulkan halaman yang terbalik atau miring. Bisa seluruh dokumen atau halaman tertentu saja."
      accent="violet"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Putar Halaman"
      endpoint={API_ENDPOINTS.toolsRotate}
      options={options}
      note="Sudut ditambahkan ke rotasi yang sudah ada, jadi halaman yang memang sudah miring tidak dipaksa kembali lurus."
      buildFormData={(files) => {
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("angle", String(angle));
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: RotateCw,
          title: "Tanpa Gambar Ulang",
          desc: "Hanya penanda rotasi halaman yang diubah, jadi tidak ada mutu yang hilang.",
        },
        {
          icon: Layers,
          title: "Per Halaman",
          desc: "Putar halaman tertentu saja, sisanya dibiarkan apa adanya.",
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
