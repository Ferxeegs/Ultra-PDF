"use client";

import { AlignLeft, FileText, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function TxtToPdfPage() {
  return (
    <ToolWorkspace
      title="Teks ke "
      titleAccent="PDF"
      description="Ubah berkas teks polos, RTF, atau ODT menjadi PDF yang siap dibagikan."
      accent="blue"
      accept=".txt,.rtf,.odt"
      uploadLabel="Tarik dan lepas file teks di sini"
      uploadSubLabel="Mendukung TXT, RTF, dan ODT"
      actionLabel="Ubah ke PDF"
      endpoint={API_ENDPOINTS.convertToPdf}
      note="Lebih dari satu berkas akan diunduh sebagai satu ZIP."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        return formData;
      }}
      features={[
        {
          icon: AlignLeft,
          title: "Teks Tetap Terbaca",
          desc: "Paragraf dan pemenggalan baris dipertahankan seperti berkas aslinya.",
        },
        {
          icon: FileText,
          title: "RTF dan ODT Sekalian",
          desc: "Format teks berformat ikut didukung, bukan cuma teks polos.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "Berkas Anda dihapus dari server segera setelah konversi selesai.",
        },
      ]}
    />
  );
}
