"use client";

import { useState, useRef, useEffect } from "react";
import { X, Crop, Palette, RotateCcw, Check, Image as ImageIcon, Contrast, Sparkles, Loader2, Eye } from "lucide-react";
import { removeBackground } from "@imgly/background-removal";

interface ImageEditorProps {
  imageSrc: string;
  onSave: (editedImageDataUrl: string) => void;
  onClose: () => void;
  allowDirectSave?: boolean; // Jika true, tampilkan opsi save langsung
  onSaveDirect?: (editedImageDataUrl: string) => void; // Callback untuk save langsung
}

export default function ImageEditor({ imageSrc, onSave, onClose, allowDirectSave = false, onSaveDirect }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [invert, setInvert] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
  const [cropResizeHandle, setCropResizeHandle] = useState<string | null>(null); // 'nw', 'ne', 'sw', 'se'
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setOriginalImage(img);
      imageRef.current = img;
      // Reset crop area to full image
      setCropStart({ x: 0, y: 0 });
      setCropEnd({ x: img.width, y: img.height });
      renderImage();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Initialize crop area when cropping is enabled
  useEffect(() => {
    if (isCropping && imageRef.current) {
      const img = imageRef.current;
      // Set default crop area to full image size, starting from top-left corner
      setCropStart({
        x: 0,
        y: 0,
      });
      setCropEnd({
        x: img.width,
        y: img.height,
      });
    }
  }, [isCropping]);

  // Generate CSS filter string for preview
  const getCSSFilter = () => {
    const filters = [];
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);
    if (invert) filters.push('invert(100%)');
    return filters.length > 0 ? filters.join(' ') : 'none';
  };


  // Render image with filters and crop - using CSS filter for fast preview
  const renderImage = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match container
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate image dimensions maintaining aspect ratio
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = canvas.width / imgAspect;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
    }

    // Use CSS filter for fast preview (much faster than pixel manipulation)
    ctx.filter = getCSSFilter();
    // Apply opacity
    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.filter = 'none'; // Reset filter
    ctx.globalAlpha = 1.0; // Reset alpha

    // Draw crop overlay if cropping
    if (isCropping) {
      // Calculate crop area in canvas coordinates
      const cropX = Math.min(cropStart.x, cropEnd.x);
      const cropY = Math.min(cropStart.y, cropEnd.y);
      const cropWidth = Math.abs(cropEnd.x - cropStart.x);
      const cropHeight = Math.abs(cropEnd.y - cropStart.y);

      // Convert image coordinates to canvas coordinates
      const imageToCanvasX = (imgX: number) => drawX + (imgX / img.width) * drawWidth;
      const imageToCanvasY = (imgY: number) => drawY + (imgY / img.height) * drawHeight;
      
      const cropXCanvas = imageToCanvasX(cropX);
      const cropYCanvas = imageToCanvasY(cropY);
      const cropWidthCanvas = (cropWidth / img.width) * drawWidth;
      const cropHeightCanvas = (cropHeight / img.height) * drawHeight;

      // Darken outside crop area
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clear crop area
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(cropXCanvas, cropYCanvas, cropWidthCanvas, cropHeightCanvas);
      
      // Draw crop border
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cropXCanvas, cropYCanvas, cropWidthCanvas, cropHeightCanvas);
      
      // Draw corner handles (larger and more visible)
      const handleSize = 12;
      ctx.setLineDash([]);
      ctx.fillStyle = "#3b82f6";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      
      // Top-left
      ctx.fillRect(cropXCanvas - handleSize/2, cropYCanvas - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropXCanvas - handleSize/2, cropYCanvas - handleSize/2, handleSize, handleSize);
      // Top-right
      ctx.fillRect(cropXCanvas + cropWidthCanvas - handleSize/2, cropYCanvas - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropXCanvas + cropWidthCanvas - handleSize/2, cropYCanvas - handleSize/2, handleSize, handleSize);
      // Bottom-left
      ctx.fillRect(cropXCanvas - handleSize/2, cropYCanvas + cropHeightCanvas - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropXCanvas - handleSize/2, cropYCanvas + cropHeightCanvas - handleSize/2, handleSize, handleSize);
      // Bottom-right
      ctx.fillRect(cropXCanvas + cropWidthCanvas - handleSize/2, cropYCanvas + cropHeightCanvas - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cropXCanvas + cropWidthCanvas - handleSize/2, cropYCanvas + cropHeightCanvas - handleSize/2, handleSize, handleSize);
    }
  };

  // Re-render when filters or crop change
  useEffect(() => {
    if (imageRef.current) {
      renderImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saturation, brightness, contrast, grayscale, invert, opacity, isCropping, cropStart, cropEnd]);

  // Handle mouse events for cropping
  const getImageCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert canvas coordinates to image coordinates
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = canvas.width / imgAspect;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
    }

    // Convert to image coordinates
    const imgX = Math.max(0, Math.min(img.width, ((x - drawX) / drawWidth) * img.width));
    const imgY = Math.max(0, Math.min(img.height, ((y - drawY) / drawHeight) * img.height));

    return { x: imgX, y: imgY };
  };

  // Check if point is inside crop area
  const isPointInCropArea = (x: number, y: number): boolean => {
    const cropX = Math.min(cropStart.x, cropEnd.x);
    const cropY = Math.min(cropStart.y, cropEnd.y);
    const cropWidth = Math.abs(cropEnd.x - cropStart.x);
    const cropHeight = Math.abs(cropEnd.y - cropStart.y);
    return x >= cropX && x <= cropX + cropWidth && y >= cropY && y <= cropY + cropHeight;
  };

  // Check if point is near a crop handle
  const getCropHandle = (mouseEvent: React.MouseEvent<HTMLCanvasElement>): string | null => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = mouseEvent.clientX - rect.left;
    const mouseY = mouseEvent.clientY - rect.top;

    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = canvas.width / imgAspect;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
    }

    const imageToCanvasX = (imgX: number) => drawX + (imgX / img.width) * drawWidth;
    const imageToCanvasY = (imgY: number) => drawY + (imgY / img.height) * drawHeight;

    const cropX = Math.min(cropStart.x, cropEnd.x);
    const cropY = Math.min(cropStart.y, cropEnd.y);
    const cropWidth = Math.abs(cropEnd.x - cropStart.x);
    const cropHeight = Math.abs(cropEnd.y - cropStart.y);

    const handleSize = 15; // Larger hit area

    const cropXCanvas = imageToCanvasX(cropX);
    const cropYCanvas = imageToCanvasY(cropY);
    const cropWidthCanvas = (cropWidth / img.width) * drawWidth;
    const cropHeightCanvas = (cropHeight / img.height) * drawHeight;

    // Check each corner handle
    const handles = {
      nw: { x: cropXCanvas - handleSize/2, y: cropYCanvas - handleSize/2 },
      ne: { x: cropXCanvas + cropWidthCanvas - handleSize/2, y: cropYCanvas - handleSize/2 },
      sw: { x: cropXCanvas - handleSize/2, y: cropYCanvas + cropHeightCanvas - handleSize/2 },
      se: { x: cropXCanvas + cropWidthCanvas - handleSize/2, y: cropYCanvas + cropHeightCanvas - handleSize/2 },
    };

    for (const [key, handle] of Object.entries(handles)) {
      if (
        mouseX >= handle.x &&
        mouseX <= handle.x + handleSize &&
        mouseY >= handle.y &&
        mouseY <= handle.y + handleSize
      ) {
        return key;
      }
    }

    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) {
      // No action when not cropping
      return;
    }

    const coords = getImageCoords(e);
    const img = imageRef.current;
    if (!img) return;

    // Check if clicking on a handle
    const handle = getCropHandle(e);
    if (handle) {
      setIsResizingCrop(true);
      setCropResizeHandle(handle);
      setCropDragStart(coords);
      return;
    }

    // Check if clicking inside crop area
    if (isPointInCropArea(coords.x, coords.y)) {
      setIsDraggingCrop(true);
      setCropDragStart(coords);
      return;
    }

    // Clicking outside - create new crop area (fallback, but we already have default)
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) return;

    const coords = getImageCoords(e);
    const img = imageRef.current;
    if (!img) return;

    if (isResizingCrop && cropResizeHandle) {
      // Resize crop area based on handle
      const cropX = Math.min(cropStart.x, cropEnd.x);
      const cropY = Math.min(cropStart.y, cropEnd.y);
      const cropWidth = Math.abs(cropEnd.x - cropStart.x);
      const cropHeight = Math.abs(cropEnd.y - cropStart.y);

      let newCropX = cropX;
      let newCropY = cropY;
      let newCropWidth = cropWidth;
      let newCropHeight = cropHeight;

      const deltaX = coords.x - cropDragStart.x;
      const deltaY = coords.y - cropDragStart.y;

      switch (cropResizeHandle) {
        case 'nw': // Top-left
          newCropX = Math.max(0, Math.min(cropX + cropWidth - 20, cropX + deltaX));
          newCropY = Math.max(0, Math.min(cropY + cropHeight - 20, cropY + deltaY));
          newCropWidth = cropWidth - (newCropX - cropX);
          newCropHeight = cropHeight - (newCropY - cropY);
          break;
        case 'ne': // Top-right
          newCropY = Math.max(0, Math.min(cropY + cropHeight - 20, cropY + deltaY));
          newCropWidth = Math.max(20, Math.min(img.width - cropX, cropWidth + deltaX));
          newCropHeight = cropHeight - (newCropY - cropY);
          break;
        case 'sw': // Bottom-left
          newCropX = Math.max(0, Math.min(cropX + cropWidth - 20, cropX + deltaX));
          newCropWidth = cropWidth - (newCropX - cropX);
          newCropHeight = Math.max(20, Math.min(img.height - cropY, cropHeight + deltaY));
          break;
        case 'se': // Bottom-right
          newCropWidth = Math.max(20, Math.min(img.width - cropX, cropWidth + deltaX));
          newCropHeight = Math.max(20, Math.min(img.height - cropY, cropHeight + deltaY));
          break;
      }

      // Ensure crop area stays within image bounds
      if (newCropX + newCropWidth > img.width) {
        newCropWidth = img.width - newCropX;
      }
      if (newCropY + newCropHeight > img.height) {
        newCropHeight = img.height - newCropY;
      }

      setCropStart({ x: newCropX, y: newCropY });
      setCropEnd({ x: newCropX + newCropWidth, y: newCropY + newCropHeight });
      setCropDragStart(coords);
      return;
    }

    if (isDraggingCrop) {
      // Move crop area
      const cropX = Math.min(cropStart.x, cropEnd.x);
      const cropY = Math.min(cropStart.y, cropEnd.y);
      const cropWidth = Math.abs(cropEnd.x - cropStart.x);
      const cropHeight = Math.abs(cropEnd.y - cropStart.y);

      const deltaX = coords.x - cropDragStart.x;
      const deltaY = coords.y - cropDragStart.y;

      let newCropX = cropX + deltaX;
      let newCropY = cropY + deltaY;

      // Clamp to image bounds
      newCropX = Math.max(0, Math.min(img.width - cropWidth, newCropX));
      newCropY = Math.max(0, Math.min(img.height - cropHeight, newCropY));

      setCropStart({ x: newCropX, y: newCropY });
      setCropEnd({ x: newCropX + cropWidth, y: newCropY + cropHeight });
      setCropDragStart(coords);
      return;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingCrop(false);
    setIsResizingCrop(false);
    setCropResizeHandle(null);
  };

  const applyCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const cropX = Math.min(cropStart.x, cropEnd.x);
    const cropY = Math.min(cropStart.y, cropEnd.y);
    const cropWidth = Math.abs(cropEnd.x - cropStart.x);
    const cropHeight = Math.abs(cropEnd.y - cropStart.y);

    if (cropWidth === 0 || cropHeight === 0) return;

    // Create new canvas for cropped image
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext("2d");
    if (!ctx) return;

    // Draw cropped portion with CSS filter (faster)
    ctx.filter = getCSSFilter();
    // Apply opacity
    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0; // Reset alpha

    // Update image reference
    const newImg = new Image();
    newImg.onload = () => {
      imageRef.current = newImg;
      setOriginalImage(newImg);
      // Reset crop to full image
      setCropStart({ x: 0, y: 0 });
      setCropEnd({ x: newImg.width, y: newImg.height });
      setIsCropping(false);
      // Reset filters after crop
      setSaturation(100);
      setBrightness(100);
      setContrast(100);
      setGrayscale(0);
      setInvert(false);
      setOpacity(100);
      renderImage();
    };
    newImg.src = croppedCanvas.toDataURL("image/png");
  };

  const handleSave = () => {
    const img = imageRef.current;
    if (!img) return;

    // Create output canvas
    const outputCanvas = document.createElement("canvas");
    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return;

    // Determine output size
    let outputWidth = img.width;
    let outputHeight = img.height;
    let sourceX = 0;
    let sourceY = 0;

    if (isCropping) {
      const cropX = Math.min(cropStart.x, cropEnd.x);
      const cropY = Math.min(cropStart.y, cropEnd.y);
      const cropWidth = Math.abs(cropEnd.x - cropStart.x);
      const cropHeight = Math.abs(cropEnd.y - cropStart.y);
      
      if (cropWidth > 0 && cropHeight > 0) {
        outputWidth = cropWidth;
        outputHeight = cropHeight;
        sourceX = cropX;
        sourceY = cropY;
      }
    }

    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    
    // Use ctx.filter for final output (better quality for PDF integration)
    ctx.filter = getCSSFilter();
    // Apply opacity
    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(img, sourceX, sourceY, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0; // Reset alpha

    onSave(outputCanvas.toDataURL("image/png"));
  };

  const resetFilters = () => {
    setSaturation(100);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setInvert(false);
    setOpacity(100);
  };

  // Fungsi untuk membersihkan sisa warna putih (dijalankan SETELAH model ML selesai)
  const cleanRemainingWhite = async (imageBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(imageBlob);
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          URL.revokeObjectURL(img.src);
          resolve(URL.createObjectURL(imageBlob)); // Fallback ke blob asli jika gagal
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Loop untuk membuang pixel yang masih berwarna putih/abu-abu terang
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Threshold: jika R, G, dan B semuanya di atas 200 (mendekati putih)
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Jadikan transparan sepenuhnya
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(img.src);
        resolve(dataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(URL.createObjectURL(imageBlob)); // Fallback ke blob asli jika gagal
      };
    });
  };

  const handleRemoveBackground = async () => {
    const img = imageRef.current;
    if (!img) return;

    setIsRemovingBackground(true);
    try {
      // Convert image to blob for background removal
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsRemovingBackground(false);
        return;
      }

      // Draw image with current filters applied
      ctx.filter = getCSSFilter();
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/png");
      });

      // Remove background using medium model (isnet_fp16 - ~80MB, better quality)
      const blobWithoutBackground = await removeBackground(blob, {
        model: "isnet_fp16", // Medium model (half precision) for better quality
      });

      // Refinement: Clean remaining white pixels
      const cleanedDataUrl = await cleanRemainingWhite(blobWithoutBackground);

      // Convert cleaned result back to image
      const newImg = new Image();
      newImg.crossOrigin = "anonymous";
      newImg.onload = () => {
        imageRef.current = newImg;
        setOriginalImage(newImg);
        // Reset crop area to full image
        setCropStart({ x: 0, y: 0 });
        setCropEnd({ x: newImg.width, y: newImg.height });
        // Reset filters after background removal
        setSaturation(100);
        setBrightness(100);
        setContrast(100);
        setGrayscale(0);
        setInvert(false);
        setOpacity(100);
        renderImage();
        setIsRemovingBackground(false);
      };
      newImg.onerror = () => {
        setIsRemovingBackground(false);
      };
      newImg.src = cleanedDataUrl;
    } catch (error) {
      console.error("Error removing background:", error);
      setIsRemovingBackground(false);
      alert("Gagal menghapus latar belakang. Silakan coba lagi.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Palette size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Editor Gambar</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Edit dan sesuaikan gambar tanda tangan Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Controls */}
          <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Background Removal Section */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-slate-600 dark:text-slate-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Hapus Latar Belakang</h4>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleRemoveBackground}
                    disabled={isRemovingBackground}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      isRemovingBackground
                        ? "bg-slate-400 text-white cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md shadow-purple-500/30"
                    }`}
                  >
                    {isRemovingBackground ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Hapus Latar Belakang</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Hapus latar belakang gambar secara otomatis menggunakan AI
                  </p>
                </div>
              </div>

              {/* Crop Section */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Crop size={18} className="text-slate-600 dark:text-slate-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Crop Gambar</h4>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsCropping(!isCropping);
                      if (isCropping) {
                        if (imageRef.current) {
                          setCropStart({ x: 0, y: 0 });
                          setCropEnd({ x: imageRef.current.width, y: imageRef.current.height });
                        }
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      isCropping
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Crop size={16} />
                    <span>{isCropping ? "Nonaktifkan Crop" : "Aktifkan Crop"}</span>
                  </button>
                  {isCropping && (
                    <button
                      onClick={applyCrop}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-500/30"
                    >
                      <Check size={16} />
                      <span>Terapkan Crop</span>
                    </button>
                  )}
                  {isCropping && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium text-center">
                        💡 Tips Crop:
                      </p>
                      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <li>• Drag area crop untuk memindahkan</li>
                        <li>• Drag handle di sudut untuk resize</li>
                        <li>• Area crop sudah muncul otomatis</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Adjustments */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Palette size={18} className="text-slate-600 dark:text-slate-400" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Penyesuaian Warna</h4>
                  </div>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                    title="Reset semua filter"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Saturation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Saturasi</label>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {saturation}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="0.5"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Brightness */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Kecerahan</label>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {brightness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="0.5"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Kontras</label>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {contrast}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="0.5"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Grayscale */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Grayscale</label>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {grayscale}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={grayscale}
                      onChange={(e) => setGrayscale(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Ubah ke hitam putih untuk tampilan formal
                    </p>
                  </div>

                  {/* Invert */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Invert Warna</label>
                      <button
                        onClick={() => setInvert(!invert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          invert ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            invert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Balikkan warna gambar (hitam jadi putih, putih jadi hitam)
                    </p>
                  </div>

                  {/* Opacity */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-slate-600 dark:text-slate-400" />
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Transparansi</label>
                      </div>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {opacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Atur tingkat transparansi gambar (0% = transparan penuh, 100% = tidak transparan)
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right - Canvas Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas Container */}
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-900 overflow-auto">
              <div
                ref={containerRef}
                className="relative bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700"
                style={{ minWidth: '600px', minHeight: '400px', maxWidth: '100%', maxHeight: '100%' }}
              >
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full ${
                    isCropping 
                      ? (isDraggingCrop ? 'cursor-move' : isResizingCrop ? 'cursor-nwse-resize' : 'cursor-move')
                      : 'cursor-default'
                  }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm transition-all"
                >
                  Batal
                </button>
                {allowDirectSave && onSaveDirect ? (
                  <>
                    <button
                      onClick={() => {
                        if (!onSaveDirect) return;
                        
                        const img = imageRef.current;
                        if (!img) return;
                        
                        // Create output canvas (same logic as handleSave)
                        const outputCanvas = document.createElement("canvas");
                        const ctx = outputCanvas.getContext("2d");
                        if (!ctx) return;
                        
                        // Determine output size
                        let outputWidth = img.width;
                        let outputHeight = img.height;
                        let sourceX = 0;
                        let sourceY = 0;
                        
                        if (isCropping) {
                          const cropX = Math.min(cropStart.x, cropEnd.x);
                          const cropY = Math.min(cropStart.y, cropEnd.y);
                          const cropWidth = Math.abs(cropEnd.x - cropStart.x);
                          const cropHeight = Math.abs(cropEnd.y - cropStart.y);
                          
                          if (cropWidth > 0 && cropHeight > 0) {
                            outputWidth = cropWidth;
                            outputHeight = cropHeight;
                            sourceX = cropX;
                            sourceY = cropY;
                          }
                        }
                        
                        outputCanvas.width = outputWidth;
                        outputCanvas.height = outputHeight;
                        
                        // Use ctx.filter for final output
                        ctx.filter = getCSSFilter();
                        // Apply opacity
                        ctx.globalAlpha = opacity / 100;
                        ctx.drawImage(img, sourceX, sourceY, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
                        ctx.filter = 'none';
                        ctx.globalAlpha = 1.0; // Reset alpha
                        
                        // Save directly to parent
                        onSaveDirect(outputCanvas.toDataURL("image/png"));
                      }}
                      className="flex-[2] py-2.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/30"
                    >
                      <Check size={18} />
                      <span>Simpan & Gunakan</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSave}
                    className="flex-[2] py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30"
                  >
                    <Check size={18} />
                    <span>Simpan Perubahan</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

