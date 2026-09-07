"use client";

import { useState } from "react";
import { Lock, MonitorPlay, Presentation } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToPowerPointPage() {
  const [dpi, setDpi] = useState(150);

  const options = (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        Resolusi slide: <span className="text-amber-600 dark:text-amber-400">{dpi} DPI</span>
      </label>
      <input
        type="range"
        min={72}
        max={300}
        step={1}
        value={dpi}
        onChange={(event) => setDpi(Number(event.target.value))}
        className="w-full accent-amber-500"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Makin tinggi makin tajam saat diproyeksikan, tetapi ukuran berkasnya juga
        makin besar.
      </p>
    </div>
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="PowerPoint"
      description="Ubah tiap halaman PDF menjadi satu slide PPTX yang siap dipresentasikan."
      accent="amber"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke PowerPoint"
      endpoint={API_ENDPOINTS.convertFromPdf}
      // Tiap halaman dirender jadi gambar slide, jadi dijalankan sebagai job async
      background
      note="Setiap halaman menjadi satu slide dengan ukuran mengikuti halaman aslinya."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "pptx");
        formData.append("dpi", String(dpi));
        return formData;
      }}
      features={[
        {
          icon: Presentation,
          title: "Satu Halaman Satu Slide",
          desc: "Urutan halaman dipertahankan sehingga alur presentasi tetap sama.",
        },
        {
          icon: MonitorPlay,
          title: "Tajam di Proyektor",
          desc: "Resolusi render bisa dinaikkan sampai 300 DPI untuk layar besar.",
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
