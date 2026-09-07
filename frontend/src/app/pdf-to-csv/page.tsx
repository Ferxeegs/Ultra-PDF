"use client";

import { useState } from "react";
import { Grid3x3, Lock, Table } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToCsvPage() {
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
        className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
      />
    </div>
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="CSV"
      description="Ambil tabel dari PDF sebagai berkas CSV yang siap diimpor ke alat analisis mana pun."
      accent="emerald"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ambil Tabelnya"
      endpoint={API_ENDPOINTS.convertFromPdf}
      // Deteksi tabel memindai tiap halaman, jadi dijalankan sebagai job async
      background
      note="Tiap tabel menjadi satu berkas CSV terpisah. PDF tanpa tabel akan ditolak dengan penjelasan."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "csv");
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Table,
          title: "Satu Tabel Satu Berkas",
          desc: "Tiap tabel berdiri sendiri sehingga gampang diimpor tanpa perlu dipilah dulu.",
        },
        {
          icon: Grid3x3,
          title: "Rapi di Excel",
          desc: "Ditulis dengan penanda UTF-8 supaya karakter non-Latin tidak berantakan saat dibuka.",
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
