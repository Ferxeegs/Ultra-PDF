"use client";

import { GitCompare, FileText, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function ComparePdfPage() {
  return (
    <ToolWorkspace
      title="Bandingkan "
      titleAccent="PDF"
      description="Lihat baris mana saja yang ditambah dan dihapus di antara dua versi dokumen, dirangkum jadi satu laporan PDF."
      accent="amber"
      accept=".pdf"
      uploadLabel="Tarik dan lepas dua file PDF di sini"
      uploadSubLabel="Berkas pertama jadi versi lama, kedua jadi versi baru"
      actionLabel="Bandingkan"
      endpoint={API_ENDPOINTS.toolsCompare}
      note="Urutan berkas menentukan arah perbandingan; berkas pertama dianggap versi lama."
      buildFormData={(files) => {
        if (files.length !== 2) {
          throw new Error("Pilih tepat dua berkas PDF untuk dibandingkan");
        }

        const formData = new FormData();
        formData.append("original", files[0]);
        formData.append("revised", files[1]);
        return formData;
      }}
      features={[
        {
          icon: GitCompare,
          title: "Per Baris",
          desc: "Bukan sekadar berbeda: baris yang ditambah dan dihapus ditandai jelas.",
        },
        {
          icon: FileText,
          title: "Laporan PDF",
          desc: "Hasilnya berupa PDF bergaya diff, siap dibagikan atau dicetak.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "Kedua PDF dihapus dari server segera setelah laporan dibuat.",
        },
      ]}
    />
  );
}
