"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  SquareCheck,
  TextCursorInput,
  Zap,
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import { API_ENDPOINTS } from "@/utils/api";

/**
 * Pengisi formulir PDF (AcroForm).
 *
 * Backend membaca daftar isian dari berkasnya, lalu halaman ini membangun
 * formulir HTML biasa dari daftar itu - jadi pengguna tidak perlu pembaca PDF
 * yang mendukung formulir untuk mengisinya.
 */

interface FormField {
  nama: string;
  jenis: string;
  nilai: string | boolean | number | null;
  pilihan: string[];
  wajib: boolean;
  hanya_baca: boolean;
  halaman: number;
}

/** Nama jenis isian dari PyMuPDF, dipetakan ke label yang enak dibaca. */
function labelJenis(jenis: string): string {
  const kind = jenis.toLowerCase();
  if (kind.includes("check")) return "Kotak centang";
  if (kind.includes("radio")) return "Pilihan tunggal";
  if (kind.includes("combo") || kind.includes("list")) return "Daftar pilihan";
  if (kind.includes("signature")) return "Tanda tangan";
  return "Isian teks";
}

function isCheckbox(field: FormField): boolean {
  return field.jenis.toLowerCase().includes("check");
}

function isChoice(field: FormField): boolean {
  const kind = field.jenis.toLowerCase();
  return (
    field.pilihan.length > 0 &&
    (kind.includes("combo") || kind.includes("list") || kind.includes("radio"))
  );
}

export default function PdfFormsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [flatten, setFlatten] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);

  const uploadRef = useRef<FileUploadZoneRef>(null);
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const acceptFile = async (incoming: File) => {
    if (!incoming.name.toLowerCase().endsWith(".pdf")) {
      setError("Hanya berkas PDF yang bisa dibaca formulirnya");
      return;
    }

    setError(null);
    setResult(null);
    setIsReading(true);
    setFile(incoming);

    try {
      const formData = new FormData();
      formData.append("file", incoming);

      const response = await fetch(API_ENDPOINTS.toolsFormFields, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Gagal membaca formulir");
      }

      const data = (await response.json()) as { isian: FormField[] };
      setFields(data.isian);
      setValues(
        Object.fromEntries(
          data.isian.map((field) => [
            field.nama,
            typeof field.nilai === "boolean"
              ? field.nilai
                ? "ya"
                : ""
              : String(field.nilai ?? ""),
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca formulir");
      setFile(null);
      setFields([]);
    } finally {
      setIsReading(false);
    }
  };

  const handleSave = async () => {
    if (!file || isSaving) return;

    const kosong = fields.find(
      (field) => field.wajib && !field.hanya_baca && !values[field.nama]?.trim()
    );
    if (kosong) {
      setError(`Isian wajib "${kosong.nama}" belum diisi`);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // Isian hanya-baca tidak ikut dikirim: backend memang melewatinya, dan
      // menyertakannya cuma membuat muatan permintaan membengkak.
      const payload = Object.fromEntries(
        fields
          .filter((field) => !field.hanya_baca)
          .map((field) => [field.nama, values[field.nama] ?? ""])
      );

      const formData = new FormData();
      formData.append("file", file);
      formData.append("values", JSON.stringify(payload));
      formData.append("flatten", String(flatten));

      const response = await fetch(API_ENDPOINTS.toolsFillForm, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Gagal menyimpan formulir");
      }

      const blob = await response.blob();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;

      setResult({
        url,
        name: file.name.replace(/\.pdf$/i, "") + "-terisi.pdf",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan formulir");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFields([]);
    setValues({});
    setResult(null);
    setError(null);
    uploadRef.current?.reset();
  };

  const inputClass =
    "w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-emerald-100/50 dark:bg-emerald-900/10" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-6 shadow-sm bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={14} />
            <span>Aman &amp; Otomatis Dihapus</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Formulir <span className="text-emerald-600 dark:text-emerald-400">PDF</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Isi formulir PDF langsung dari browser, lalu simpan hasilnya - bisa
            tetap bisa diubah atau dikunci sekalian.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          {result ? (
            <div className="p-8 space-y-5">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 dark:text-green-300">Selesai</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1 break-all">
                  {result.name}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={result.url}
                  download={result.name}
                  className="flex-1 min-w-[200px] py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                >
                  <Download size={20} />
                  Unduh Hasil
                </a>
                <button
                  onClick={() => setResult(null)}
                  className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl hover:bg-emerald-100 font-semibold transition-all"
                >
                  Ubah Isian
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 font-semibold transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Berkas Lain
                </button>
              </div>
            </div>
          ) : !file ? (
            <>
              <FileUploadZone
                ref={uploadRef}
                isDragging={isDragging}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const dropped = event.dataTransfer.files[0];
                  if (dropped) acceptFile(dropped);
                }}
                onFileChange={(event) => {
                  const picked = event.target.files?.[0];
                  if (picked) acceptFile(picked);
                }}
                multiple={false}
                accept=".pdf"
                label="Tarik dan lepas formulir PDF di sini"
                subLabel="Satu berkas per proses"
              />
              {error && (
                <div className="mx-6 mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100 dark:border-slate-600">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <FileText size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-slate-800 dark:text-slate-200">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isReading ? "Membaca isian..." : `${fields.length} isian ditemukan`}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                >
                  Ganti
                </button>
              </div>

              {isReading ? (
                <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="animate-spin" />
                  <p className="text-sm font-medium">Membaca formulir...</p>
                </div>
              ) : fields.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    PDF ini tidak punya isian formulir
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Berkasnya berupa dokumen biasa, bukan formulir AcroForm.
                    Untuk menulis di atasnya, pakai Sunting PDF atau Tanda Tangan
                    PDF.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    {fields.map((field) => (
                      <div key={field.nama}>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          {field.nama}
                          {field.wajib && <span className="text-red-500 ml-1">*</span>}
                          <span className="text-slate-400 dark:text-slate-500 font-normal ml-2 text-xs">
                            {labelJenis(field.jenis)} &middot; hal. {field.halaman}
                            {field.hanya_baca && " · hanya baca"}
                          </span>
                        </label>

                        {isCheckbox(field) ? (
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={field.hanya_baca}
                              checked={Boolean(values[field.nama])}
                              onChange={(event) =>
                                setValues((previous) => ({
                                  ...previous,
                                  [field.nama]: event.target.checked ? "ya" : "",
                                }))
                              }
                              className="w-4 h-4 accent-emerald-600"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              Centang bila sesuai
                            </span>
                          </label>
                        ) : isChoice(field) ? (
                          <select
                            disabled={field.hanya_baca}
                            value={values[field.nama] ?? ""}
                            onChange={(event) =>
                              setValues((previous) => ({
                                ...previous,
                                [field.nama]: event.target.value,
                              }))
                            }
                            className={inputClass}
                          >
                            <option value="">- pilih -</option>
                            {field.pilihan.map((choice) => (
                              <option key={choice} value={choice}>
                                {choice}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled={field.hanya_baca}
                            value={values[field.nama] ?? ""}
                            onChange={(event) =>
                              setValues((previous) => ({
                                ...previous,
                                [field.nama]: event.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer border-t border-slate-100 dark:border-slate-700 pt-5">
                    <input
                      type="checkbox"
                      checked={flatten}
                      onChange={(event) => setFlatten(event.target.checked)}
                      className="mt-1 w-4 h-4 accent-emerald-600"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                        Kunci isian setelah disimpan
                      </span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                        Isian dicetak jadi bagian tetap halaman sehingga tidak
                        bisa diubah lagi. Cocok untuk formulir yang sudah final.
                      </span>
                    </span>
                  </label>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                      <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-5 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                    <span className="text-lg">Simpan Formulir</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
          {[
            {
              icon: TextCursorInput,
              title: "Isian Terdeteksi",
              desc: "Nama dan jenis tiap isian dibaca langsung dari berkasnya.",
            },
            {
              icon: SquareCheck,
              title: "Bisa Dikunci",
              desc: "Simpan sebagai formulir yang masih bisa diubah, atau kunci sekalian.",
            },
            {
              icon: Lock,
              title: "Berkas Aman",
              desc: "PDF Anda dihapus dari server segera setelah proses selesai.",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                  <Icon size={20} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>

        <Footer />
      </div>
    </main>
  );
}
