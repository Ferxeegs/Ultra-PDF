"use client";

import { Hash, List, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function MarkdownToPdfPage() {
  return (
    <ToolWorkspace
      title="Markdown ke "
      titleAccent="PDF"
      description="Ubah catatan Markdown menjadi PDF rapi, lengkap dengan heading, tabel, dan blok kode."
      accent="sky"
      accept=".md,.markdown"
      uploadLabel="Tarik dan lepas file Markdown di sini"
      uploadSubLabel="Mendukung .md dan .markdown"
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
          icon: Hash,
          title: "Heading Tetap Rapi",
          desc: "Judul, daftar, dan kutipan diterjemahkan menjadi tata letak cetak yang enak dibaca.",
        },
        {
          icon: List,
          title: "Tabel dan Kode",
          desc: "Blok kode memakai font monospace dan tabel diberi garis agar mudah dilacak.",
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
