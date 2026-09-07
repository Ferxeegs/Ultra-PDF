"use client";

import { useState } from "react";
import { Hash, Lock, Type } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

type TextFormat = "txt" | "md";

export default function PdfToTextPage() {
  const [format, setFormat] = useState<TextFormat>("txt");
  const [pages, setPages] = useState("");

  const options = (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Format hasil
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                id: "txt" as TextFormat,
                title: "Teks polos (.txt)",
                desc: "Isi dokumen apa adanya, tanpa penanda format sama sekali.",
              },
              {
                id: "md" as TextFormat,
                title: "Markdown (.md)",
                desc: "Struktur heading ikut ditulis sehingga rapi dibaca ulang.",
              },
            ]
          ).map((choice) => (
            <button
              key={choice.id}
              onClick={() => setFormat(choice.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                format === choice.id
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-500"
                  : "border-slate-200 dark:border-slate-600 hover:border-sky-300"
              }`}
            >
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {choice.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {choice.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Halaman
          <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
            (kosongkan untuk semua)
          </span>
        </label>
        <input
          type="text"
          value={pages}
          onChange={(event) => setPages(event.target.value)}
          placeholder="Contoh: 1-3,7"
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="PDF ke "
      titleAccent="Teks"
      description="Ambil seluruh isi tulisan dari PDF sebagai teks polos atau Markdown yang siap diolah lagi."
      accent="sky"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Ambil Teksnya"
      endpoint={API_ENDPOINTS.convertFromPdf}
      note="PDF hasil pindaian tanpa lapisan teks akan menghasilkan berkas kosong."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target", format);
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: Type,
          title: "Siap Disalin",
          desc: "Cocok untuk mengutip isi dokumen tanpa perlu menyeleksi manual di pembaca PDF.",
        },
        {
          icon: Hash,
          title: "Bisa Markdown",
          desc: "Pilihan Markdown menambahkan heading per halaman agar hasilnya tetap terstruktur.",
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
