"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CameraOff,
  Download,
  ImagePlus,
  Loader2,
  Lock,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SwitchCamera,
  Trash2,
  Zap,
} from "lucide-react";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import { API_ENDPOINTS } from "@/utils/api";
import { useUniversalConvert } from "@/hooks/useUniversalConvert";

/**
 * Pindai dokumen lewat kamera lalu jadikan satu PDF.
 *
 * Pengambilan gambar sepenuhnya di browser; yang dikirim ke server hanya
 * JPEG hasil jepretan, digabung memakai jalur gambar-ke-PDF yang sudah ada.
 */

interface Shot {
  id: string;
  url: string;
  blob: Blob;
}

const PAGE_SIZES = [
  { id: "auto", label: "Ikut foto" },
  { id: "a4", label: "A4" },
  { id: "letter", label: "Letter" },
];

export default function ScanToPdfPage() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState("a4");
  const [marginMm, setMarginMm] = useState(8);
  const [grayscale, setGrayscale] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<Shot[]>([]);

  const { convert, cancel, reset, isProcessing, progress, statusMessage, error, result } =
    useUniversalConvert();

  // Salinan terbaru dipakai saat pembersihan, karena fungsi bersih-bersih di
  // useEffect hanya menangkap nilai pada saat dipasang.
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  }, []);

  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Browser ini tidak mendukung akses kamera. Anda masih bisa menambah foto dari galeri."
        );
        return;
      }

      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setIsCameraOn(true);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setCameraError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan lewat pengaturan situs, atau tambahkan foto dari galeri."
            : "Kamera tidak bisa dibuka. Anda masih bisa menambah foto dari galeri."
        );
        setIsCameraOn(false);
      }
    },
    []
  );

  // Matikan kamera dan bebaskan pratinjau saat halaman ditinggalkan
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
  }, []);

  const addShot = (blob: Blob) => {
    setShots((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: URL.createObjectURL(blob),
        blob,
      },
    ]);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (grayscale) {
      // Abu-abu berkontras tinggi meniru hasil pemindai: tulisan lebih tegas
      // dan berkasnya jauh lebih kecil daripada foto berwarna.
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        const boosted = Math.min(255, Math.max(0, (luma - 128) * 1.35 + 138));
        pixels[i] = pixels[i + 1] = pixels[i + 2] = boosted;
      }
      context.putImageData(image, 0, 0);
    }

    canvas.toBlob(
      (blob) => {
        if (blob) addShot(blob);
      },
      "image/jpeg",
      0.92
    );
  };

  const removeShot = (id: string) => {
    setShots((previous) => {
      const target = previous.find((shot) => shot.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return previous.filter((shot) => shot.id !== id);
    });
  };

  const handleBuild = async () => {
    if (shots.length === 0 || isProcessing) return;

    const formData = new FormData();
    shots.forEach((shot, index) => {
      formData.append("files", shot.blob, `pindai-${index + 1}.jpg`);
    });
    formData.append("merge_images", "true");
    formData.append("page_size", pageSize);
    formData.append("orientation", "portrait");
    formData.append("margin_mm", String(pageSize === "auto" ? 0 : marginMm));

    await convert({ endpoint: API_ENDPOINTS.convertToPdf, formData });
  };

  const handleReset = () => {
    shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    setShots([]);
    reset();
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-amber-100/50 dark:bg-amber-900/10" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-6 shadow-sm bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400">
            <ShieldCheck size={14} />
            <span>Aman &amp; Otomatis Dihapus</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Pindai ke <span className="text-amber-600 dark:text-amber-400">PDF</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Foto dokumen lewat kamera, susun halamannya, lalu simpan semuanya
            sebagai satu berkas PDF.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden">
          {result ? (
            <div className="p-8 space-y-5">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 dark:text-green-300">Selesai</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1 break-all">
                  {result.fileName}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={result.url}
                  download={result.fileName}
                  className="flex-1 min-w-[200px] py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                >
                  <Download size={20} />
                  Unduh PDF
                </a>
                <button
                  onClick={handleReset}
                  className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 font-semibold transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Pindai Lagi
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Jendela kamera */}
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-contain ${isCameraOn ? "" : "hidden"}`}
                />
                {!isCameraOn && (
                  <div className="text-center px-6">
                    <CameraOff className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      Kamera belum aktif
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {!isCameraOn ? (
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="flex-1 min-w-[160px] py-4 bg-slate-900 dark:bg-amber-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all"
                  >
                    <Camera size={20} />
                    Nyalakan Kamera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capture}
                      className="flex-1 min-w-[160px] py-4 bg-slate-900 dark:bg-amber-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all"
                    >
                      <ScanLine size={20} />
                      Ambil Halaman
                    </button>
                    <button
                      onClick={() => {
                        const next = facingMode === "environment" ? "user" : "environment";
                        setFacingMode(next);
                        startCamera(next);
                      }}
                      aria-label="Ganti kamera"
                      className="px-5 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-2xl hover:bg-slate-50 font-semibold transition-all"
                    >
                      <SwitchCamera size={20} />
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-5 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-2xl hover:bg-slate-50 font-semibold transition-all"
                    >
                      <CameraOff size={20} />
                    </button>
                  </>
                )}

                <label className="px-5 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-2xl hover:bg-slate-50 font-semibold transition-all cursor-pointer flex items-center gap-2">
                  <ImagePlus size={20} />
                  <span className="text-sm">Dari Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      Array.from(event.target.files || []).forEach(addShot);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grayscale}
                  onChange={(event) => setGrayscale(event.target.checked)}
                  className="mt-1 w-4 h-4 accent-amber-600"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Mode dokumen (abu-abu berkontras)
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                    Tulisan jadi lebih tegas dan berkasnya lebih kecil. Berlaku
                    untuk jepretan berikutnya.
                  </span>
                </span>
              </label>

              {cameraError && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex items-start gap-3 text-amber-700 dark:text-amber-400 text-sm font-medium">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Halaman yang sudah diambil */}
              {shots.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    {shots.length} halaman siap
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {shots.map((shot, index) => (
                      <div
                        key={shot.id}
                        className="relative group rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shot.url}
                          alt={`Halaman ${index + 1}`}
                          className="w-full h-28 object-cover"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-bold">
                          {index + 1}
                        </span>
                        <button
                          onClick={() => removeShot(shot.id)}
                          aria-label={`Hapus halaman ${index + 1}`}
                          className="absolute top-1 right-1 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {shots.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                      Ukuran halaman
                    </label>
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(event.target.value)}
                      className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium"
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                      Margin:{" "}
                      <span className="text-amber-600 dark:text-amber-400">
                        {pageSize === "auto" ? "0" : marginMm} mm
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      disabled={pageSize === "auto"}
                      value={marginMm}
                      onChange={(event) => setMarginMm(Number(event.target.value))}
                      className="w-full accent-amber-500 disabled:opacity-40 mt-4"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isProcessing && (
                <div>
                  <ProgressBar
                    progress={progress}
                    label={(statusMessage || "Menyusun PDF").toUpperCase()}
                  />
                  <button
                    onClick={cancel}
                    className="w-full py-3 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Batalkan
                  </button>
                </div>
              )}

              {shots.length > 0 && (
                <button
                  onClick={handleBuild}
                  disabled={isProcessing}
                  className="w-full py-5 bg-slate-900 dark:bg-amber-600 text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                  <span className="text-lg">Jadikan PDF</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
          {[
            {
              icon: Camera,
              title: "Langsung dari Kamera",
              desc: "Tidak perlu aplikasi pemindai, cukup kamera perangkat Anda.",
            },
            {
              icon: ScanLine,
              title: "Mode Dokumen",
              desc: "Abu-abu berkontras membuat tulisan lebih tegas dan berkas lebih ringan.",
            },
            {
              icon: Lock,
              title: "Berkas Aman",
              desc: "Foto diproses lalu dihapus dari server, tidak pernah disimpan permanen.",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
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
