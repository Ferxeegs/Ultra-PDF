"use client";

import { useState } from "react";
import { ScanText, Search, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function OcrPdfPage() {
  const [force, setForce] = useState(false);

  const options = (
    <div>
      <label className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer hover:border-violet-300 transition-all">
        <input
          type="checkbox"
          checked={force}
          onChange={(event) => setForce(event.target.checked)}
          className="mt-0.5 w-4 h-4 accent-violet-500"
        />
        <span>
          <span className="block font-bold text-sm text-slate-800 dark:text-slate-200">
            Kenali ulang semua halaman
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Biasanya halaman yang sudah punya teks dilewati karena lapisan
            aslinya lebih akurat. Aktifkan ini kalau teks yang ada ternyata
            berantakan.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <ToolWorkspace
      title="OCR "
      titleAccent="PDF"
      description="Ubah PDF hasil pindaian menjadi PDF yang teksnya bisa dicari dan disalin, tanpa mengubah tampilan halamannya."
      accent="violet"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF hasil scan di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Jalankan OCR"
      endpoint={API_ENDPOINTS.toolsOcr}
      // Pengenalan teks butuh beberapa detik per halaman, jadi dijalankan
      // sebagai job latar belakang agar tidak tertahan batas waktu HTTP
      background
      note="Butuh beberapa detik per halaman; progresnya tampil di bar di atas."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("force", force ? "true" : "false");
        formData.append("mode", "async");
        return formData;
      }}
      features={[
        {
          icon: Search,
          title: "Bisa Dicari",
          desc: "Teksnya bisa dicari lewat Ctrl+F dan disalin seperti PDF biasa.",
        },
        {
          icon: ScanText,
          title: "Tampilan Tetap Sama",
          desc: "Teks ditaruh tak terlihat di atas gambar, jadi halamannya tidak berubah sedikit pun.",
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
