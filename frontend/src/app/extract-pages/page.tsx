"use client";

import { useState } from "react";
import { FileOutput, ListChecks, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function ExtractPagesPage() {
  const [pages, setPages] = useState("");

  const options = (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        Halaman yang diambil
      </label>
      <input
        type="text"
        value={pages}
        onChange={(event) => setPages(event.target.value)}
        placeholder="Contoh: 2,5-9"
        className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
        Pisahkan dengan koma. Gunakan tanda hubung untuk rentang, dan biarkan
        sisi kanan kosong (mis. <span className="font-mono">8-</span>) untuk
        mengambil sampai halaman terakhir.
      </p>
    </div>
  );

  return (
    <ToolWorkspace
      title="Ambil "
      titleAccent="Halaman"
      description="Petik halaman tertentu dari sebuah PDF menjadi berkas baru, tanpa mengubah dokumen aslinya."
      accent="emerald"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Ambil Halaman"
      endpoint={API_ENDPOINTS.toolsExtractPages}
      options={options}
      note="Butuh tiap halaman sebagai berkas terpisah? Pakai Split PDF."
      buildFormData={(files) => {
        if (!pages.trim()) {
          throw new Error("Sebutkan halaman yang mau diambil, mis. 1-3,7");
        }

        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: FileOutput,
          title: "Satu Berkas Rapi",
          desc: "Semua halaman terpilih digabung jadi satu PDF, bukan tercecer.",
        },
        {
          icon: ListChecks,
          title: "Isi Asli Terjaga",
          desc: "Teks, gambar, dan tautan halaman terpilih dibawa apa adanya.",
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
