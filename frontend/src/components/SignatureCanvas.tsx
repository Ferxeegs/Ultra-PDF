"use client";

import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { X, RotateCcw, Download, Upload, Palette, MoveHorizontal } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export default function SignaturePad({ onSave, onClose }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  const [penColor, setPenColor] = useState("#000000");
  const [maxWidth, setMaxWidth] = useState(2.5);
  const [hasSignature, setHasSignature] = useState(false);
  const [isUploadMode, setIsUploadMode] = useState(false);

  // =================================================================
  // FUNGSI INI AKAN MEMAKSA PERUBAHAN WARNA PADA DATA YANG SUDAH ADA
  // =================================================================
  const changeExistingColor = (newColor: string) => {
    const canvas = sigCanvas.current;
    if (!canvas || canvas.isEmpty() || isUploadMode) return;

    // 1. Ambil instance internal dari signature_pad
    const pad = (canvas as any).getSignaturePad();
    
    // 2. Ambil data mentah (array of strokes)
    const data = pad.toData();

    // 3. Iterasi mendalam: Ubah warna di level stroke DAN level titik (points)
    const newData = data.map((stroke: any) => {
      // Ubah warna garis
      stroke.color = newColor;
      
      // Ubah warna setiap titik di dalam garis tersebut (ini kuncinya!)
      if (stroke.points) {
        stroke.points.forEach((point: any) => {
          point.color = newColor;
        });
      }
      return stroke;
    });

    // 4. Update data internal dan gambar ulang
    pad.fromData(newData);
    
    // 5. Pastikan tinta untuk goresan berikutnya juga berubah
    pad.penColor = newColor;
  };

  // Efek saat state penColor berubah
  useEffect(() => {
    if (hasSignature && !isUploadMode) {
      changeExistingColor(penColor);
    }
  }, [penColor]);

  // =================================================================

  const handleDrawingEnd = () => {
    if (sigCanvas.current) {
      setHasSignature(!sigCanvas.current.isEmpty());
    }
  };

  const clear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
    setIsUploadMode(false);
  };

  const handleSave = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    
    // Ambil hasil yang sudah dipotong (trimmed) agar rapi
    const trimmedCanvas = sigCanvas.current.getTrimmedCanvas();
    onSave(trimmedCanvas.toDataURL("image/png"));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      sigCanvas.current?.fromDataURL(dataUrl, {
        ratio: 1, width: 800, height: 300,
      });
      setHasSignature(true);
      setIsUploadMode(true); 
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tanda Tangan Digital</h3>
            <p className="text-sm text-slate-500">Klik warna di bawah untuk mengubah warna coretan secara langsung.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Color Palette */}
            <div className={`flex items-center gap-3 ${isUploadMode ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <Palette size={18} className="text-slate-500" />
              <div className="flex gap-2 items-center">
                {["#000000", "#2563eb", "#dc2626", "#16a34a", "#9333ea"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      penColor === color ? "scale-110 border-white ring-2 ring-blue-500 shadow-md" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom Color Picker */}
                <label className="relative cursor-pointer group">
                  <div className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden ${
                    !["#000000", "#2563eb", "#dc2626", "#16a34a", "#9333ea"].includes(penColor)
                      ? "scale-110 border-white ring-2 ring-blue-500 shadow-md"
                      : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}>
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      style={{
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        appearance: "none"
                      }}
                      title="Pilih warna kustom"
                    />
                    <div 
                      className="w-full h-full rounded-full"
                      style={{ backgroundColor: penColor }}
                    />
                    {!["#000000", "#2563eb", "#dc2626", "#16a34a", "#9333ea"].includes(penColor) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Palette size={12} className="text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Thickness Slider */}
            <div className="flex items-center gap-3 flex-1 max-w-xs border-l pl-6 border-slate-300 dark:border-slate-700 ml-auto">
              <MoveHorizontal size={18} className="text-slate-500" />
              <input
                type="range" min="1" max="8" step="0.5"
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-mono font-bold w-8">{maxWidth}pt</span>
            </div>
          </div>

          {/* Drawing Area */}
          <div className="relative bg-white rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 h-[300px] shadow-inner">
            <SignatureCanvas
              ref={sigCanvas}
              penColor={penColor}
              minWidth={maxWidth / 3}
              maxWidth={maxWidth}
              velocityFilterWeight={0.7}
              onEnd={handleDrawingEnd}
              onBegin={() => {
                if(isUploadMode) clear();
                setHasSignature(true);
              }}
              canvasProps={{
                className: "signature-canvas w-full h-full cursor-crosshair",
                style: { touchAction: "none" }
              }}
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 select-none">
                Coretkan tanda tangan di sini
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3">
            <label className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all">
              <Upload size={18} />
              <span>Upload Gambar</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>

            <button
              onClick={clear}
              className="py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center gap-2 transition-all"
            >
              <RotateCcw size={18} />
              <span>Hapus</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!hasSignature}
              className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              <Download size={18} />
              <span>Simpan Tanda Tangan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}