"use client";

import { Lock, Sheet, Table } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToExcelPage() {
  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="Excel"
      description="Tarik tabel dari PDF langsung menjadi lembar kerja Excel yang siap dihitung."
      accent="emerald"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke Excel"
      endpoint={API_ENDPOINTS.convertFromPdf}
      // Deteksi tabel memindai tiap halaman, jadi dijalankan sebagai job async
      background
      note="Tiap tabel yang terdeteksi menjadi satu sheet terpisah di berkas hasil."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "xlsx");
        return formData;
      }}
      features={[
        {
          icon: Table,
          title: "Tabel Terdeteksi Otomatis",
          desc: "Baris dan kolom dikenali tanpa perlu menandai area secara manual.",
        },
        {
          icon: Sheet,
          title: "Rapi per Sheet",
          desc: "Setiap tabel ditempatkan di sheet sendiri agar mudah ditelusuri.",
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
