"use client";

import { BookOpen, Lock, Printer } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function EpubToPdfPage() {
  return (
    <ToolWorkspace
      title="EPUB ke "
      titleAccent="PDF"
      description="Ubah e-book EPUB menjadi PDF supaya bisa dibaca dan dicetak di mana saja."
      accent="violet"
      accept=".epub"
      uploadLabel="Tarik dan lepas file EPUB di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ubah ke PDF"
      endpoint={API_ENDPOINTS.convertToPdf}
      background
      note="Bab disusun berurutan mengikuti daftar isi bawaan e-book."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        return formData;
      }}
      features={[
        {
          icon: BookOpen,
          title: "Urutan Bab Terjaga",
          desc: "Isi buku dirangkai sesuai urutan bacaan aslinya, bukan acak per berkas.",
        },
        {
          icon: Printer,
          title: "Siap Dicetak",
          desc: "Teks mengalir ditata ulang ke ukuran halaman tetap sehingga enak dicetak.",
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
