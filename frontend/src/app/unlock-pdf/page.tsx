"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Unlock } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

export default function UnlockPdfPage() {
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const options = (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
        Kata sandi dokumen
      </label>
      <div className="relative">
        <input
          type={isVisible ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
          placeholder="Masukkan kata sandi PDF"
          className="w-full px-4 py-3.5 pr-12 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        />
        <button
          type="button"
          onClick={() => setIsVisible((previous) => !previous)}
          aria-label={isVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
        Kata sandi hanya dipakai sekali untuk membuka dokumen dan tidak pernah disimpan.
        Bila mengunggah beberapa berkas, semuanya harus memakai kata sandi yang sama.
      </p>
    </div>
  );

  return (
    <ToolWorkspace
      title="Unlock "
      titleAccent="PDF"
      description="Lepas proteksi kata sandi dari PDF milik Anda supaya bebas dibuka, disalin, dan dicetak."
      accent="sky"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF terkunci di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Buka Kunci PDF"
      endpoint={API_ENDPOINTS.securityUnlock}
      options={options}
      note="Gunakan hanya untuk dokumen yang memang Anda miliki atau berhak akses."
      buildFormData={(files) => {
        if (!password.trim()) {
          throw new Error("Masukkan kata sandi dokumen terlebih dahulu");
        }

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("password", password);
        return formData;
      }}
      features={[
        {
          icon: Unlock,
          title: "Bebas Dipakai Lagi",
          desc: "Hasilnya PDF biasa yang bisa dibuka tanpa perlu mengetik kata sandi.",
        },
        {
          icon: KeyRound,
          title: "Sandi Tidak Disimpan",
          desc: "Kata sandi hanya ada di memori selama proses, lalu langsung dibuang.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "Dokumen Anda dihapus dari server segera setelah hasilnya dikirim.",
        },
      ]}
    />
  );
}
