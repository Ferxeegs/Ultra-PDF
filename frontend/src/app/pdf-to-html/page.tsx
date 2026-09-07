"use client";

import { useState } from "react";
import { Braces, Globe, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToHtmlPage() {
  const [pages, setPages] = useState("");

  const options = (
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
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="HTML"
      description="Ubah PDF menjadi satu halaman HTML yang bisa langsung dibuka di browser."
      accent="indigo"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke HTML"
      endpoint={API_ENDPOINTS.convertFromPdf}
      note="Semua halaman digabung menjadi satu berkas, masing-masing dipisah sebagai bagian tersendiri."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "html");
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Globe,
          title: "Langsung Bisa Dibuka",
          desc: "Hasilnya satu berkas HTML utuh, tinggal klik dua kali untuk melihatnya.",
        },
        {
          icon: Braces,
          title: "Posisi Teks Terjaga",
          desc: "Letak tulisan dipertahankan sehingga tampilannya mirip dokumen aslinya.",
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
