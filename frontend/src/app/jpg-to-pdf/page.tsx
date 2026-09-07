"use client";

import { useState } from "react";
import { FileStack, Lock, Ruler } from "lucide-react";
import ToolWorkspace from "@/components/ToolWorkspace";
import { API_ENDPOINTS } from "@/utils/api";

const PAGE_SIZES = [
  { id: "auto", label: "Ikut ukuran gambar" },
  { id: "a4", label: "A4" },
  { id: "letter", label: "Letter" },
  { id: "a5", label: "A5" },
  { id: "a3", label: "A3" },
];

export default function JpgToPdfPage() {
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginMm, setMarginMm] = useState(10);
  const [mergeImages, setMergeImages] = useState(true);

  // Ukuran halaman "auto" mengikuti dimensi gambar, jadi orientasi dan margin
  // tidak punya arti di sana
  const layoutEditable = pageSize !== "auto";

  const options = (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Ukuran halaman
        </label>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(event.target.value)}
          className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">Orientasi</p>
        <div className="grid grid-cols-2 gap-3">
          {(["portrait", "landscape"] as const).map((value) => (
            <button
              key={value}
              disabled={!layoutEditable}
              onClick={() => setOrientation(value)}
              className={`py-3.5 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                orientation === value && layoutEditable
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                  : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {value === "portrait" ? "Potret" : "Lanskap"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          Margin: <span className="text-amber-600 dark:text-amber-400">{marginMm} mm</span>
        </label>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={marginMm}
          disabled={!layoutEditable}
          onChange={(event) => setMarginMm(Number(event.target.value))}
          className="w-full accent-amber-500 disabled:opacity-40"
        />
        {!layoutEditable && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Orientasi dan margin baru bisa diatur setelah memilih ukuran halaman tetap.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={mergeImages}
          onChange={(event) => setMergeImages(event.target.checked)}
          className="mt-0.5 w-5 h-5 accent-amber-500"
        />
        <span>
          <span className="block font-bold text-sm text-slate-800 dark:text-slate-200">
            Gabungkan jadi satu PDF
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Semua gambar disusun berurutan dalam satu dokumen. Matikan untuk mendapat satu
            PDF per gambar.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <ToolWorkspace
      title="JPG ke "
      titleAccent="PDF"
      description="Susun foto JPG, PNG, atau WEBP menjadi PDF rapi dengan orientasi dan margin sesuai selera."
      accent="amber"
      accept=".jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff,.heic,.heif"
      uploadLabel="Tarik dan lepas gambar di sini"
      uploadSubLabel="JPG, PNG, WEBP, BMP, GIF, TIFF, HEIC"
      actionLabel="Ubah ke PDF"
      endpoint={API_ENDPOINTS.convertToPdf}
      note="Urutan halaman mengikuti urutan berkas pada daftar di atas."
      options={options}
      buildFormData={(files) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("merge_images", mergeImages ? "true" : "false");
        formData.append("page_size", pageSize);
        formData.append("orientation", orientation);
        formData.append("margin_mm", String(marginMm));
        return formData;
      }}
      features={[
        {
          icon: Ruler,
          title: "Tata Letak Fleksibel",
          desc: "Pilih A3 sampai Letter, atur orientasi dan margin sebelum dikonversi.",
        },
        {
          icon: FileStack,
          title: "Banyak Gambar Sekaligus",
          desc: "Gabungkan puluhan foto menjadi satu dokumen dalam sekali proses.",
        },
        {
          icon: Lock,
          title: "Berkas Aman",
          desc: "Gambar Anda dihapus dari server segera setelah PDF selesai dibuat.",
        },
      ]}
    />
  );
}
