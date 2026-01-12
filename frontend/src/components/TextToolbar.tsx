"use client";

import { useState, useEffect, useRef } from "react";
import { X, Palette, Type, SlidersHorizontal, Copy } from "lucide-react";

export interface TextPosition {
  id: string;
  fileId: string;
  pageNumber: number;
  x: number; // PDF points
  y: number; // PDF points
  text: string;
  fontSize: number; // PDF points
  color: string; // HEX color
  opacity: number; // 0-100
  fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier';
  pdfPageWidth: number; // PDF points
  pdfPageHeight: number; // PDF points
  dpi?: number; // DPI untuk rasterisasi (default: 150)
  blur?: number; // Blur radius dalam pixels (default: 0)
}

interface TextToolbarProps {
  textPosition: TextPosition;
  onUpdate: (updated: TextPosition) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate?: () => void; // Optional duplicate handler
  position: { x: number; y: number }; // Position in browser pixels
}

export default function TextToolbar({
  textPosition,
  onUpdate,
  onClose,
  onDelete,
  onDuplicate,
  position,
}: TextToolbarProps) {
  const [localText, setLocalText] = useState(textPosition.text);
  const [localColor, setLocalColor] = useState(textPosition.color);
  const [localOpacity, setLocalOpacity] = useState(textPosition.opacity);
  const [localFontFamily, setLocalFontFamily] = useState(textPosition.fontFamily);
  const [localFontSize, setLocalFontSize] = useState(textPosition.fontSize);
  const [localDpi, setLocalDpi] = useState(textPosition.dpi || 150);
  const [localBlur, setLocalBlur] = useState(textPosition.blur || 0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Update local state when textPosition changes
  useEffect(() => {
    setLocalText(textPosition.text);
    setLocalColor(textPosition.color);
    setLocalOpacity(textPosition.opacity);
    setLocalFontFamily(textPosition.fontFamily);
    setLocalFontSize(textPosition.fontSize);
    setLocalDpi(textPosition.dpi || 150);
    setLocalBlur(textPosition.blur || 0);
  }, [textPosition]);

  // Convert HEX to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  // Handle updates
  const handleUpdate = (updates: Partial<TextPosition>) => {
    onUpdate({ ...textPosition, ...updates });
  };

  // Position toolbar near the text
  useEffect(() => {
    if (toolbarRef.current) {
      const toolbar = toolbarRef.current;
      const rect = toolbar.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust position to keep toolbar in viewport
      let x = position.x;
      let y = position.y - rect.height - 10; // Above the text

      // If toolbar would go off screen, adjust
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      if (x < 10) {
        x = 10;
      }
      if (y < 10) {
        y = position.y + 40; // Below the text if no space above
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10;
      }

      toolbar.style.left = `${x}px`;
      toolbar.style.top = `${y}px`;
    }
  }, [position]);

  return (
    <div
      ref={toolbarRef}
      className="text-toolbar fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-blue-500 dark:border-blue-400 p-4 min-w-[320px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 200}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Teks</h3>
        </div>
        <div className="flex items-center gap-2">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="Duplikat teks (Ctrl+D)"
            >
              <Copy size={16} className="text-blue-600 dark:text-blue-400" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
            title="Hapus teks"
          >
            <X size={16} className="text-red-600 dark:text-red-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            title="Tutup toolbar"
          >
            <X size={16} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Text Input */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Teks
        </label>
        <input
          type="text"
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value);
            handleUpdate({ text: e.target.value });
          }}
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Masukkan teks..."
        />
      </div>

      {/* Color Picker */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <Palette size={14} />
          Warna
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={localColor}
            onChange={(e) => {
              setLocalColor(e.target.value);
              handleUpdate({ color: e.target.value });
            }}
            className="w-12 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
            title="Pilih warna"
          />
          <input
            type="text"
            value={localColor}
            onChange={(e) => {
              const hex = e.target.value;
              if (/^#[0-9A-F]{6}$/i.test(hex)) {
                setLocalColor(hex);
                handleUpdate({ color: hex });
              }
            }}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Opacity Slider */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <SlidersHorizontal size={14} />
          Opacity: {localOpacity}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={localOpacity}
          onChange={(e) => {
            const opacity = parseInt(e.target.value);
            setLocalOpacity(opacity);
            handleUpdate({ opacity });
          }}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Font Family */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Font
        </label>
        <select
          value={localFontFamily}
          onChange={(e) => {
            const font = e.target.value as 'Helvetica' | 'TimesRoman' | 'Courier';
            setLocalFontFamily(font);
            handleUpdate({ fontFamily: font });
          }}
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Helvetica">Helvetica</option>
          <option value="TimesRoman">Times Roman</option>
          <option value="Courier">Courier</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Ukuran Font: {localFontSize}pt
        </label>
        <input
          type="range"
          min="8"
          max="72"
          value={localFontSize}
          onChange={(e) => {
            const fontSize = parseInt(e.target.value);
            setLocalFontSize(fontSize);
            handleUpdate({ fontSize });
          }}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* DPI Setting */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          DPI (Resolusi): {localDpi}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="72"
            max="300"
            step="1"
            value={localDpi}
            onChange={(e) => {
              const dpi = parseInt(e.target.value);
              setLocalDpi(dpi);
              handleUpdate({ dpi });
            }}
            className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
            {localDpi}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Sesuaikan dengan resolusi dokumen asli (scan biasanya 150-200 DPI)
        </p>
      </div>

      {/* Blur Setting */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Blur (Ketajaman): {localBlur.toFixed(1)}px
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={localBlur}
            onChange={(e) => {
              const blur = parseFloat(e.target.value);
              setLocalBlur(blur);
              handleUpdate({ blur });
            }}
            className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
            {localBlur.toFixed(1)}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tambahkan blur ringan untuk menyamakan dengan dokumen scan
        </p>
      </div>
    </div>
  );
}

