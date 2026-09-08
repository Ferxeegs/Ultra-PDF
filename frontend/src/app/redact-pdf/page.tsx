"use client";

import { useState } from "react";
import { EyeOff, Search, Lock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function RedactPdfPage() {
  const [terms, setTerms] = useState("");
  const [pages, setPages] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [color, setColor] = useState("#000000");

  const options = (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Kata atau frasa yang disensor
        </label>
        <textarea
          value={terms}
          onChange={(event) => setTerms(event.target.value)}
          rows={4}
          placeholder={"Satu per baris, contoh:\nNIK 3273xxxxxxxx\nbudi@contoh.com\nRahasia"}
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all resize-y"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
          Tiap baris dicari di seluruh halaman terpilih dan dihapus permanen
          dari isi dokumen, bukan sekadar ditutupi.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
            Warna penutup
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="w-14 h-[52px] rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer"
            />
            <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
              {color.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(event) => setCaseSensitive(event.target.checked)}
          className="mt-1 w-4 h-4 accent-slate-700"
        />
        <span>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Bedakan huruf besar dan kecil
          </span>
          <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
            Kalau dimatikan, &quot;Rahasia&quot; juga akan mengenai
            &quot;rahasia&quot; dan &quot;RAHASIA&quot;.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <ToolWorkspace
      title="Sensor "
      titleAccent="PDF"
      description="Hapus permanen nama, nomor, atau kata sensitif dari sebuah PDF sebelum dokumennya dibagikan."
      accent="blue"
      accept=".pdf"
      multiple={false}
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Satu berkas per proses"
      actionLabel="Sensor Sekarang"
      endpoint={API_ENDPOINTS.toolsRedact}
      options={options}
      note="Untuk PDF hasil pindaian, jalankan OCR PDF lebih dulu supaya teksnya bisa ditemukan."
      buildFormData={(files) => {
        if (!terms.trim()) {
          throw new Error("Isi minimal satu kata atau frasa yang mau disensor");
        }

        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("terms", terms);
        formData.append("case_sensitive", String(caseSensitive));
        formData.append("color", color);
        if (pages.trim()) formData.append("pages", pages.trim());
        return formData;
      }}
      features={[
        {
          icon: EyeOff,
          title: "Hilang Sungguhan",
          desc: "Teksnya dibuang dari isi halaman, tidak bisa disalin atau dicari lagi.",
        },
        {
          icon: Search,
          title: "Cari Otomatis",
          desc: "Semua kemunculan istilah ditemukan sendiri, tanpa perlu ditandai satu-satu.",
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
