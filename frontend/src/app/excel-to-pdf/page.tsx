"use client";

import { useState } from "react";
import { Archive, Lock, Table2 } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function ExcelToPdfPage() {
  const [fitToPage, setFitToPage] = useState(true);
  const [archivePdf, setArchivePdf] = useState(false);

  const options = (
    <div className="space-y-4">
      <label className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={fitToPage}
          onChange={(event) => setFitToPage(event.target.checked)}
          className="mt-0.5 w-5 h-5 accent-emerald-500"
        />
        <span>
          <span className="block font-bold text-sm text-slate-800 dark:text-slate-200">
            Muat semua kolom dalam satu halaman
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Lebar tabel dikecilkan agar tidak ada kolom yang terpotong ke halaman
            berikutnya. Matikan bila Anda ingin ukuran cetak asli.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={archivePdf}
          onChange={(event) => setArchivePdf(event.target.checked)}
          className="mt-0.5 w-5 h-5 accent-emerald-500"
        />
        <span>
          <span className="block font-bold text-sm text-slate-800 dark:text-slate-200">
            Simpan sebagai PDF/A (arsip)
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Font ikut ditanam supaya laporan tetap tampil sama bertahun-tahun ke
            depan. Ukuran berkasnya jadi lebih besar.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <ToolWorkspace
      title="Excel ke "
      titleAccent="PDF"
      description="Ubah lembar kerja Excel, ODS, atau CSV menjadi PDF yang rapi dan siap dibagikan."
      accent="emerald"
      accept=".xls,.xlsx,.ods,.csv"
      uploadLabel="Tarik dan lepas file Excel di sini"
      uploadSubLabel="Mendukung XLS, XLSX, ODS, dan CSV"
      actionLabel="Ubah ke PDF"
      endpoint={API_ENDPOINTS.convertToPdf}
      // Spreadsheet besar bisa lama diproses LibreOffice, jadi dijalankan
      // sebagai job latar belakang agar tidak tertahan batas waktu HTTP
      background
      note="Lebih dari satu berkas akan diunduh sebagai satu ZIP."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("fit_to_page", String(fitToPage));
        if (archivePdf) formData.append("pdf_variant", "pdfa");
        return formData;
      }}
      features={[
        {
          icon: Table2,
          title: "Kolom Tidak Terpotong",
          desc: "Opsi muat satu halaman menjaga tabel lebar tetap terbaca utuh.",
        },
        {
          icon: Archive,
          title: "Siap Diarsipkan",
          desc: "Hasilnya bisa langsung dibuat memenuhi standar PDF/A untuk simpanan jangka panjang.",
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
