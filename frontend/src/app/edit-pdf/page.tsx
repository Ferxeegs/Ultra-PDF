"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eraser,
  Highlighter,
  Loader2,
  Minus,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Type,
  Zap,
} from "lucide-react";
import FileUploadZone, { FileUploadZoneRef } from "@/components/FileUploadZone";
import Footer from "@/components/Footer";
import { API_ENDPOINTS } from "@/utils/api";
import { getPdfDocument, getPdfjsLibExport } from "@/utils/pdfjs";

/**
 * Editor PDF sederhana: bubuhkan teks dan bentuk di atas halaman yang sudah ada.
 *
 * Halaman digambar dengan pdf.js, sedangkan itemnya hanya lapisan HTML di
 * atasnya. Koordinat disimpan sebagai pecahan 0..1 terhadap ukuran halaman,
 * jadi tampilan di layar berapa pun lebarnya tetap menghasilkan penempatan yang
 * sama saat backend menggambar ulang dengan PyMuPDF.
 */

type Kind = "teks" | "kotak" | "elips" | "garis" | "sorot" | "hapus";

interface EditItem {
  id: string;
  halaman: number;
  jenis: Kind;
  /** pecahan 0..1 terhadap lebar/tinggi halaman, titik nol di kiri-atas */
  x: number;
  y: number;
  lebar: number;
  tinggi: number;
  teks?: string;
  ukuran_huruf?: number;
  warna: string;
  tebal?: number;
  opasitas?: number;
}

const TOOLS: { id: Kind; label: string; icon: typeof Type; hint: string }[] = [
  { id: "teks", label: "Teks", icon: Type, hint: "Tulis kalimat baru di halaman" },
  { id: "sorot", label: "Sorot", icon: Highlighter, hint: "Tandai tulisan dengan stabilo" },
  { id: "kotak", label: "Kotak", icon: Square, hint: "Gambar bingkai persegi" },
  { id: "elips", label: "Elips", icon: Circle, hint: "Gambar bingkai bulat" },
  { id: "garis", label: "Garis", icon: Minus, hint: "Tarik garis lurus" },
  { id: "hapus", label: "Tutup", icon: Eraser, hint: "Timpa bagian halaman dengan putih" },
];

/** Ukuran minimum sebuah item dalam pecahan halaman, supaya tidak jadi titik. */
const MIN_SIZE = 0.01;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export default function EditPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [isRendering, setIsRendering] = useState(false);

  const [tool, setTool] = useState<Kind>("teks");
  const [color, setColor] = useState("#d92d20");
  const [fontSize, setFontSize] = useState(14);
  const [thickness, setThickness] = useState(1.5);

  const [items, setItems] = useState<EditItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditItem | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<FileUploadZoneRef>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const dragRef = useRef<
    | { mode: "buat"; startX: number; startY: number }
    | { mode: "geser"; id: string; offsetX: number; offsetY: number }
    | null
  >(null);

  const selected = items.find((item) => item.id === selectedId) || null;
  const pageItems = items.filter((item) => item.halaman === pageNumber);

  // Bebaskan object URL hasil terakhir saat komponen dilepas
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const acceptFile = async (incoming: File) => {
    if (!incoming.name.toLowerCase().endsWith(".pdf")) {
      setError("Hanya berkas PDF yang bisa disunting di sini");
      return;
    }

    setError(null);
    setItems([]);
    setSelectedId(null);
    setPageNumber(1);
    setResult(null);

    const id = `${incoming.name}-${incoming.size}-${Date.now()}`;
    setFile(incoming);
    setFileId(id);

    try {
      await getPdfjsLibExport();
      const pdf = await getPdfDocument(id, incoming);
      setPageCount(pdf.numPages);
    } catch {
      setError("PDF ini tidak bisa dibuka. Coba perbaiki dulu lewat Repair PDF.");
      setFile(null);
    }
  };

  // Gambar ulang halaman setiap kali berkas atau nomor halaman berganti
  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!file || !canvas || pageCount === 0) return;

    setIsRendering(true);
    try {
      renderTaskRef.current?.cancel();

      const pdf = await getPdfDocument(fileId, file);
      const page = await pdf.getPage(pageNumber);

      const base = page.getViewport({ scale: 1 });
      const available = surfaceRef.current?.parentElement?.clientWidth || 720;
      const scale = available / base.width;
      // Kanvas digambar pada kerapatan layar supaya teks halaman tidak buram,
      // tapi ukuran tampilnya tetap mengikuti lebar wadah.
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * ratio });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${base.width * scale}px`;
      canvas.style.height = `${base.height * scale}px`;

      const task = page.render({ canvas, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      // Pembatalan terjadi normal saat pengguna berpindah halaman cepat
      if ((err as { name?: string })?.name !== "RenderingCancelledException") {
        setError("Halaman ini gagal digambar");
      }
    } finally {
      setIsRendering(false);
    }
  }, [file, fileId, pageNumber, pageCount]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Ukuran wadah berubah saat jendela diubah; halaman ikut digambar ulang
  useEffect(() => {
    const onResize = () => renderPage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPage]);

  const pointToFraction = (event: React.PointerEvent) => {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
    };
  };

  const handleSurfaceDown = (event: React.PointerEvent) => {
    if (isSaving) return;
    const point = pointToFraction(event);
    surfaceRef.current?.setPointerCapture(event.pointerId);

    dragRef.current = { mode: "buat", startX: point.x, startY: point.y };
    setSelectedId(null);
    setDraft({
      id: "draft",
      halaman: pageNumber,
      jenis: tool,
      x: point.x,
      y: point.y,
      lebar: 0,
      tinggi: 0,
      warna: color,
      ukuran_huruf: fontSize,
      tebal: thickness,
      teks: tool === "teks" ? "Tulis di sini" : undefined,
    });
  };

  const handleItemDown = (event: React.PointerEvent, item: EditItem) => {
    if (isSaving) return;
    event.stopPropagation();
    const point = pointToFraction(event);
    surfaceRef.current?.setPointerCapture(event.pointerId);

    setSelectedId(item.id);
    dragRef.current = {
      mode: "geser",
      id: item.id,
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
    };
  };

  const handleMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointToFraction(event);

    if (drag.mode === "buat") {
      setDraft((previous) =>
        previous
          ? {
              ...previous,
              x: Math.min(drag.startX, point.x),
              y: Math.min(drag.startY, point.y),
              lebar: Math.abs(point.x - drag.startX),
              tinggi: Math.abs(point.y - drag.startY),
            }
          : previous
      );
      return;
    }

    setItems((previous) =>
      previous.map((item) =>
        item.id === drag.id
          ? {
              ...item,
              x: clamp01(Math.min(point.x - drag.offsetX, 1 - item.lebar)),
              y: clamp01(Math.min(point.y - drag.offsetY, 1 - item.tinggi)),
            }
          : item
      )
    );
  };

  const handleUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.mode !== "buat") return;

    setDraft(null);
    if (!draft) return;

    // Sekali klik tanpa tarik dianggap "taruh di sini" dengan ukuran bawaan,
    // supaya menambah kotak teks tidak harus selalu menggambar dulu.
    const tooSmall = draft.lebar < MIN_SIZE || draft.tinggi < MIN_SIZE;
    const lebar = tooSmall ? (draft.jenis === "teks" ? 0.4 : 0.2) : draft.lebar;
    const tinggi = tooSmall ? (draft.jenis === "teks" ? 0.06 : 0.1) : draft.tinggi;

    const item: EditItem = {
      ...draft,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lebar: Math.min(lebar, 1 - draft.x),
      tinggi: Math.min(tinggi, 1 - draft.y),
    };

    setItems((previous) => [...previous, item]);
    setSelectedId(item.id);
  };

  const updateSelected = (patch: Partial<EditItem>) => {
    if (!selectedId) return;
    setItems((previous) =>
      previous.map((item) => (item.id === selectedId ? { ...item, ...patch } : item))
    );
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setItems((previous) => previous.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!file || items.length === 0 || isSaving) return;

    const kosong = items.find(
      (item) => item.jenis === "teks" && !(item.teks || "").trim()
    );
    if (kosong) {
      setPageNumber(kosong.halaman);
      setSelectedId(kosong.id);
      setError("Ada kotak teks yang masih kosong");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "items",
        JSON.stringify(
          items.map(({ id, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
        )
      );

      const response = await fetch(API_ENDPOINTS.toolsEdit, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Gagal menyimpan hasil suntingan");
      }

      const blob = await response.blob();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;

      setResult({
        url,
        name: file.name.replace(/\.pdf$/i, "") + "-disunting.pdf",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan hasil suntingan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileId("");
    setPageCount(0);
    setPageNumber(1);
    setItems([]);
    setSelectedId(null);
    setResult(null);
    setError(null);
    uploadRef.current?.reset();
  };

  const renderItem = (item: EditItem, isDraft = false) => {
    const style: React.CSSProperties = {
      left: `${item.x * 100}%`,
      top: `${item.y * 100}%`,
      width: `${item.lebar * 100}%`,
      height: `${item.tinggi * 100}%`,
    };
    const isActive = !isDraft && item.id === selectedId;
    const ring = isActive ? "outline outline-2 outline-offset-2 outline-blue-500" : "";

    let body: React.ReactNode = null;
    if (item.jenis === "teks") {
      body = (
        <span
          className="block w-full h-full overflow-hidden leading-tight break-words"
          style={{ color: item.warna, fontSize: `${item.ukuran_huruf || 14}px` }}
        >
          {item.teks}
        </span>
      );
    } else if (item.jenis === "sorot") {
      body = (
        <span
          className="block w-full h-full"
          style={{ backgroundColor: item.warna, opacity: item.opasitas ?? 0.4 }}
        />
      );
    } else if (item.jenis === "hapus") {
      body = <span className="block w-full h-full bg-white" />;
    } else if (item.jenis === "kotak") {
      body = (
        <span
          className="block w-full h-full"
          style={{ border: `${item.tebal || 1.5}px solid ${item.warna}` }}
        />
      );
    } else if (item.jenis === "elips") {
      body = (
        <span
          className="block w-full h-full rounded-[50%]"
          style={{ border: `${item.tebal || 1.5}px solid ${item.warna}` }}
        />
      );
    } else {
      body = (
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <line
            x1="0"
            y1="0"
            x2="100%"
            y2="100%"
            stroke={item.warna}
            strokeWidth={item.tebal || 1.5}
          />
        </svg>
      );
    }

    return (
      <div
        key={item.id}
        style={style}
        onPointerDown={isDraft ? undefined : (event) => handleItemDown(event, item)}
        className={`absolute ${isDraft ? "pointer-events-none opacity-70" : "cursor-move"} ${ring}`}
      >
        {body}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#FDFDFF] dark:bg-slate-900 relative py-16 px-4 sm:px-6 transition-colors duration-200">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-blue-100/50 dark:bg-blue-900/10" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-6 shadow-sm bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
            <ShieldCheck size={14} />
            <span>Aman &amp; Otomatis Dihapus</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
            Sunting <span className="text-blue-600 dark:text-blue-400">PDF</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Tambahkan tulisan, sorotan, dan bentuk langsung di atas halaman PDF
            Anda, lalu simpan sebagai berkas baru.
          </p>
        </header>

        {!file ? (
          <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden max-w-3xl mx-auto">
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
              label="Tarik dan lepas file PDF di sini"
              subLabel="Satu berkas per proses"
            />
            {error && (
              <div className="mx-6 mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : result ? (
          <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-slate-100 dark:border-slate-700 p-8 space-y-5 max-w-3xl mx-auto">
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
                className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-100 font-semibold transition-all"
              >
                Sunting Lagi
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* Kanvas halaman */}
            <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-slate-100 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate pr-4">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                    disabled={pageNumber <= 1}
                    aria-label="Halaman sebelumnya"
                    className="p-2 rounded-lg border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    {pageNumber} / {pageCount || "-"}
                  </span>
                  <button
                    onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}
                    disabled={pageNumber >= pageCount}
                    aria-label="Halaman berikutnya"
                    className="p-2 rounded-lg border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="relative flex justify-center bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 overflow-auto">
                <div className="relative inline-block shadow-md">
                  <canvas ref={canvasRef} className="block rounded-sm" />
                  <div
                    ref={surfaceRef}
                    onPointerDown={handleSurfaceDown}
                    onPointerMove={handleMove}
                    onPointerUp={handleUp}
                    onPointerCancel={handleUp}
                    className="absolute inset-0 cursor-crosshair touch-none"
                  >
                    {pageItems.map((item) => renderItem(item))}
                    {draft && draft.halaman === pageNumber && renderItem(draft, true)}
                  </div>
                  {isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
                      <Loader2 className="animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
                Klik untuk menaruh, atau tarik untuk menentukan ukurannya
                sendiri. Item yang sudah ada bisa digeser.
              </p>
            </div>

            {/* Panel alat */}
            <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-slate-100 dark:border-slate-700 p-6 space-y-5 lg:sticky lg:top-6">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                  Alat
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TOOLS.map((choice) => {
                    const Icon = choice.icon;
                    return (
                      <button
                        key={choice.id}
                        onClick={() => setTool(choice.id)}
                        title={choice.hint}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                          tool === choice.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-300"
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[11px] font-bold">{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Warna
                  </label>
                  <input
                    type="color"
                    value={selected ? selected.warna : color}
                    onChange={(event) => {
                      setColor(event.target.value);
                      updateSelected({ warna: event.target.value });
                    }}
                    className="w-full h-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {(selected?.jenis || tool) === "teks" ? "Ukuran huruf" : "Tebal garis"}
                  </label>
                  {(selected?.jenis || tool) === "teks" ? (
                    <input
                      type="number"
                      min={4}
                      max={200}
                      value={selected?.ukuran_huruf ?? fontSize}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setFontSize(next);
                        updateSelected({ ukuran_huruf: next });
                      }}
                      className="w-full h-11 px-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    />
                  ) : (
                    <input
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={selected?.tebal ?? thickness}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setThickness(next);
                        updateSelected({ tebal: next });
                      }}
                      className="w-full h-11 px-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    />
                  )}
                </div>
              </div>

              {selected ? (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Item terpilih &middot; {selected.jenis}
                  </p>
                  {selected.jenis === "teks" && (
                    <textarea
                      value={selected.teks || ""}
                      onChange={(event) => updateSelected({ teks: event.target.value })}
                      rows={3}
                      placeholder="Tulis isi kotak teks"
                      className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium resize-y"
                    />
                  )}
                  <button
                    onClick={removeSelected}
                    className="w-full py-3 rounded-xl border-2 border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Hapus Item
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-5 flex items-start gap-2 leading-relaxed">
                  <MousePointer2 size={14} className="flex-shrink-0 mt-0.5" />
                  Pilih salah satu item di halaman untuk mengubah isi, warna,
                  atau menghapusnya.
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400 text-xs font-medium">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-700 pt-5 space-y-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  {items.length} item pada {new Set(items.map((i) => i.halaman)).size} halaman
                </p>
                <button
                  onClick={handleSave}
                  disabled={isSaving || items.length === 0}
                  className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  Simpan PDF
                </button>
                <button
                  onClick={handleReset}
                  className="w-full py-3 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                >
                  Ganti berkas
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </main>
  );
}
