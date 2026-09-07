"use client";

import { Code2, Globe, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function HtmlToPdfPage() {
  return (
    <ToolWorkspace
      title="HTML ke "
      titleAccent="PDF"
      description="Ubah berkas HTML menjadi PDF dengan gaya dan tata letak yang ikut dirender."
      accent="indigo"
      accept=".html,.htm"
      uploadLabel="Tarik dan lepas file HTML di sini"
      uploadSubLabel="Mendukung .html dan .htm"
      actionLabel="Ubah ke PDF"
      endpoint={API_ENDPOINTS.convertToPdf}
      background
      note="Ingin mengubah alamat web langsung tanpa mengunduh berkasnya? Gunakan mode Dari URL di halaman Convert."
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        return formData;
      }}
      features={[
        {
          icon: Code2,
          title: "Gaya Ikut Dirender",
          desc: "CSS yang tertanam di dalam berkas diterapkan, bukan sekadar teks mentah.",
        },
        {
          icon: Globe,
          title: "Halaman Web Juga Bisa",
          desc: "Alamat web bisa dikonversi lewat mode Dari URL di halaman Convert.",
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
