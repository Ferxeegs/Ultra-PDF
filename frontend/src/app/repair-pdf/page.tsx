"use client";

import { Wrench, ShieldCheck, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function RepairPdfPage() {
  return (
    <ToolWorkspace
      title="Perbaiki "
      titleAccent="PDF"
      description="Bangun ulang PDF yang rusak atau tidak mau dibuka, lalu simpan versi bersihnya."
      accent="violet"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF yang bermasalah di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Perbaiki PDF"
      endpoint={API_ENDPOINTS.toolsRepair}
      note="Struktur berkas dibangun ulang, objek yatim dibuang, dan isinya dipadatkan."
      buildFormData={(files) => {
        const formData = new FormData();
        formData.append("file", files[0]);
        return formData;
      }}
      features={[
        {
          icon: Wrench,
          title: "Pulihkan Struktur",
          desc: "Tabel referensi silang dan trailer yang rusak disusun ulang dari isinya.",
        },
        {
          icon: ShieldCheck,
          title: "Sekaligus Lebih Ramping",
          desc: "Objek yang tidak terpakai dibuang, jadi hasilnya biasanya lebih kecil.",
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
