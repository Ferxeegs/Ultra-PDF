"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

/** Izin yang tetap boleh dilakukan pembaca meski dokumen terkunci */
const PERMISSIONS = [
  { id: "print", label: "Mencetak dokumen" },
  { id: "copy", label: "Menyalin teks dan gambar" },
  { id: "modify", label: "Mengubah isi dokumen" },
  { id: "annotate", label: "Menambah komentar dan anotasi" },
  { id: "form", label: "Mengisi kolom formulir" },
  { id: "assemble", label: "Menyusun ulang halaman" },
];

export default function ProtectPdfPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [granted, setGranted] = useState<string[]>(["print", "copy"]);
  const [isVisible, setIsVisible] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const togglePermission = (id: string) => {
    setGranted((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  };

  const inputClass =
    "w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all";

  const options = (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Kata sandi baru
        </label>
        <div className="relative">
          <input
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Kata sandi untuk membuka dokumen"
            className={`${inputClass} pr-12`}
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
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Ulangi kata sandi
        </label>
        <input
          type={isVisible ? "text" : "password"}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          placeholder="Ketik ulang untuk memastikan"
          className={inputClass}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Simpan kata sandi ini baik-baik. Tanpa kata sandi, dokumen tidak bisa dibuka lagi.
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Yang tetap boleh dilakukan pembaca
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PERMISSIONS.map((permission) => (
            <label
              key={permission.id}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer hover:border-indigo-300 transition-colors"
            >
              <input
                type="checkbox"
                checked={granted.includes(permission.id)}
                onChange={() => togglePermission(permission.id)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {permission.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((previous) => !previous)}
          className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showAdvanced ? "Sembunyikan pengaturan lanjutan" : "Pengaturan lanjutan"}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                Kata sandi pemilik
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                  (opsional)
                </span>
              </label>
              <input
                type={isVisible ? "text" : "password"}
                value={ownerPassword}
                onChange={(event) => setOwnerPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Kata sandi untuk mengubah izin"
                className={inputClass}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                Batasan izin di atas baru benar-benar mengikat bila kata sandi pemilik
                berbeda dari kata sandi pembuka. Dikosongkan berarti keduanya sama.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                Kata sandi dokumen saat ini
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                  (bila sudah terkunci)
                </span>
              </label>
              <input
                type={isVisible ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="off"
                placeholder="Isi untuk mengganti kata sandi lama"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ToolWorkspace
      title="Protect "
      titleAccent="PDF"
      description="Kunci PDF dengan kata sandi dan enkripsi AES-256 agar hanya orang yang Anda izinkan bisa membukanya."
      accent="indigo"
      accept=".pdf"
      uploadLabel="Tarik dan lepas file PDF di sini"
      uploadSubLabel="Bisa beberapa file sekaligus"
      actionLabel="Lindungi PDF"
      endpoint={API_ENDPOINTS.securityProtect}
      options={options}
      buildFormData={(files) => {
        if (!password) throw new Error("Kata sandi baru wajib diisi");
        if (password !== confirmation) {
          throw new Error("Kata sandi dan ulangannya belum sama");
        }

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("password", password);
        if (ownerPassword) formData.append("owner_password", ownerPassword);
        if (currentPassword) formData.append("current_password", currentPassword);
        if (granted.length > 0) formData.append("permissions", granted.join(","));
        return formData;
      }}
      features={[
        {
          icon: ShieldCheck,
          title: "Enkripsi AES-256",
          desc: "Standar enkripsi yang sama dengan yang dipakai perbankan dan pemerintahan.",
        },
        {
          icon: KeyRound,
          title: "Izin Bisa Dipilih",
          desc: "Tentukan sendiri apakah pembaca boleh mencetak, menyalin, atau mengubah isi.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "Dokumen dan kata sandi dihapus dari server segera setelah hasilnya dikirim.",
        },
      ]}
    />
  );
}
