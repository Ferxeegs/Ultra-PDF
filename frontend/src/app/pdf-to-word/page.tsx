"use client";

import { FileCode, Lock, Type } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToWordPage() {
  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="Word"
      description="Ubah PDF menjadi dokumen DOCX yang bisa langsung diedit, dengan tata letak yang dipertahankan."
      accent="blue"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke Word"
      endpoint={API_ENDPOINTS.convertFromPdf}
      // Ekstraksi tata letak per halaman berat, jadi dijalankan sebagai job
      // latar belakang agar tidak tertahan batas waktu HTTP
      background
      note="Dokumen panjang diproses di latar belakang; progresnya tampil di bar di atas."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "docx");
        return formData;
      }}
      features={[
        {
          icon: Type,
          title: "Teks Bisa Diedit",
          desc: "Paragraf, tabel, dan gambar dikenali ulang sehingga siap disunting di Word.",
        },
        {
          icon: FileCode,
          title: "Tata Letak Terjaga",
          desc: "Posisi elemen dipertahankan semirip mungkin dengan dokumen aslinya.",
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
