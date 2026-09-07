"use client";

import { useState } from "react";
import { Archive, Lock, ShieldCheck } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

const VERSIONS = [
  { id: 1, label: "PDF/A-1", desc: "Paling ketat, dipakai banyak lembaga pemerintahan." },
  { id: 2, label: "PDF/A-2", desc: "Pilihan seimbang dan paling umum dipakai." },
  { id: 3, label: "PDF/A-3", desc: "Sama seperti A-2, tetapi boleh menyertakan lampiran." },
];

export default function PdfToPdfaPage() {
  const [version, setVersion] = useState(2);

  const options = (
    <div>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        Versi standar arsip
      </p>
      <div className="space-y-3">
        {VERSIONS.map((item) => (
          <button
            key={item.id}
            onClick={() => setVersion(item.id)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
              version === item.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500"
                : "border-slate-200 dark:border-slate-600 hover:border-blue-300"
            }`}
          >
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {item.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {item.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="PDF/A"
      description="Ubah PDF biasa menjadi PDF/A yang memenuhi standar penyimpanan jangka panjang."
      accent="blue"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Jadikan PDF/A"
      endpoint={API_ENDPOINTS.convertFromPdf}
      background
      note="Semua font ikut ditanam ke dalam berkas, jadi ukurannya biasanya bertambah."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", "pdfa");
        formData.append("pdfa_version", String(version));
        return formData;
      }}
      features={[
        {
          icon: Archive,
          title: "Tahan Puluhan Tahun",
          desc: "Dokumen tetap tampil sama walau font aslinya sudah tidak ada di komputer mana pun.",
        },
        {
          icon: ShieldCheck,
          title: "Diterima Instansi",
          desc: "PDF/A adalah format yang diminta banyak lembaga untuk penyerahan dokumen resmi.",
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
