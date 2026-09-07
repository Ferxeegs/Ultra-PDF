"use client";

import { BookOpen, Lock, Smartphone } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function PdfToEpubPage() {
  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="EPUB"
      description="Ubah PDF menjadi e-book EPUB dengan teks mengalir yang nyaman dibaca di ponsel."
      accent="violet"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke EPUB"
      endpoint={API_ENDPOINTS.convertFromPdf}
      background
      note="EPUB memakai teks mengalir, jadi tata letak berkolom pada PDF tidak dipertahankan."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "epub");
        return formData;
      }}
      features={[
        {
          icon: Smartphone,
          title: "Nyaman di Layar Kecil",
          desc: "Teks menyesuaikan lebar layar, tidak perlu digeser ke kanan dan kiri seperti PDF.",
        },
        {
          icon: BookOpen,
          title: "Daftar Isi Otomatis",
          desc: "Tiap halaman menjadi satu bab sehingga mudah dilompati dari daftar isi.",
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
