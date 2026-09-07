"use client";

import { useState } from "react";
import { Scissors, ListChecks, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function RemovePagesPage() {
  const [pages, setPages] = useState("");

  const options = (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        Halaman yang dihapus
      </label>
      <input
        type="text"
        value={pages}
        onChange={(event) => setPages(event.target.value)}
        placeholder="Contoh: 1,4-6,10"
        className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
      />
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
        Pisahkan dengan koma. Gunakan tanda hubung untuk rentang, dan biarkan
        sisi kanan kosong (mis. <span className="font-mono">8-</span>) untuk
        menghapus sampai halaman terakhir.
      </p>
    </div>
  );

  return (
    <ToolWorkspace
      title="Hapus "
      titleAccent="Halaman"
      description="Buang halaman kosong, lampiran, atau lembar yang tidak diperlukan dari sebuah PDF."
      accent="blue"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Hapus Halaman"
      endpoint={API_ENDPOINTS.toolsRemovePages}
      options={options}
      note="Minimal satu halaman harus tersisa. Kalau ingin melihat isinya dulu sebelum memilih, pakai Organize PDF."
      buildFormData={(files) => {
        if (!pages.trim()) {
          throw new Error("Sebutkan halaman yang mau dihapus, mis. 1-3,7");
        }

        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Scissors,
          title: "Sekali Jalan",
          desc: "Beberapa rentang halaman sekaligus dalam satu kali proses.",
        },
        {
          icon: ListChecks,
          title: "Sisanya Utuh",
          desc: "Halaman yang tidak disebut tetap sama persis, termasuk urutannya.",
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
