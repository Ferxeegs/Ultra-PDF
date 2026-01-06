"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, Zap, Plus, Trash2, X, Eye } from "lucide-react";
import { DragEndEvent } from "@dnd-kit/core";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";

import { FileObject } from "@/types";
import ProgressBar from "@/components/ProgressBar";
import DownloadSection from "@/components/DownloadSection";
import SortablePageItem, { PageItem } from "@/components/SortablePageItem";
import { indexedDBManager } from "@/utils/indexedDB";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PDFDocument } from "pdf-lib";

// Color palette for different files (same as SortablePageItem)
const FILE_COLORS = [
  { 
    name: 'blue', 
    bg: 'bg-blue-500 dark:bg-blue-600', 
    border: 'border-blue-500 dark:border-blue-400',
    ring: 'ring-blue-200 dark:ring-blue-800',
    bgLight: 'bg-blue-50/50 dark:bg-blue-900/30',
    hover: 'hover:border-blue-300 dark:hover:border-blue-500',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400'
  },
  { 
    name: 'green', 
    bg: 'bg-green-500 dark:bg-green-600', 
    border: 'border-green-500 dark:border-green-400',
    ring: 'ring-green-200 dark:ring-green-800',
    bgLight: 'bg-green-50/50 dark:bg-green-900/30',
    hover: 'hover:border-green-300 dark:hover:border-green-500',
    hoverBg: 'hover:bg-green-50 dark:hover:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400'
  },
  { 
    name: 'purple', 
    bg: 'bg-purple-500 dark:bg-purple-600', 
    border: 'border-purple-500 dark:border-purple-400',
    ring: 'ring-purple-200 dark:ring-purple-800',
    bgLight: 'bg-purple-50/50 dark:bg-purple-900/30',
    hover: 'hover:border-purple-300 dark:hover:border-purple-500',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400'
  },
  { 
    name: 'pink', 
    bg: 'bg-pink-500 dark:bg-pink-600', 
    border: 'border-pink-500 dark:border-pink-400',
    ring: 'ring-pink-200 dark:ring-pink-800',
    bgLight: 'bg-pink-50/50 dark:bg-pink-900/30',
    hover: 'hover:border-pink-300 dark:hover:border-pink-500',
    hoverBg: 'hover:bg-pink-50 dark:hover:bg-pink-900/20',
    text: 'text-pink-600 dark:text-pink-400'
  },
  { 
    name: 'indigo', 
    bg: 'bg-indigo-500 dark:bg-indigo-600', 
    border: 'border-indigo-500 dark:border-indigo-400',
    ring: 'ring-indigo-200 dark:ring-indigo-800',
    bgLight: 'bg-indigo-50/50 dark:bg-indigo-900/30',
    hover: 'hover:border-indigo-300 dark:hover:border-indigo-500',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
    text: 'text-indigo-600 dark:text-indigo-400'
  },
  { 
    name: 'orange', 
    bg: 'bg-orange-500 dark:bg-orange-600', 
    border: 'border-orange-500 dark:border-orange-400',
    ring: 'ring-orange-200 dark:ring-orange-800',
    bgLight: 'bg-orange-50/50 dark:bg-orange-900/30',
    hover: 'hover:border-orange-300 dark:hover:border-orange-500',
    hoverBg: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400'
  },
  { 
    name: 'teal', 
    bg: 'bg-teal-500 dark:bg-teal-600', 
    border: 'border-teal-500 dark:border-teal-400',
    ring: 'ring-teal-200 dark:ring-teal-800',
    bgLight: 'bg-teal-50/50 dark:bg-teal-900/30',
    hover: 'hover:border-teal-300 dark:hover:border-teal-500',
    hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
    text: 'text-teal-600 dark:text-teal-400'
  },
  { 
    name: 'cyan', 
    bg: 'bg-cyan-500 dark:bg-cyan-600', 
    border: 'border-cyan-500 dark:border-cyan-400',
    ring: 'ring-cyan-200 dark:ring-cyan-800',
    bgLight: 'bg-cyan-50/50 dark:bg-cyan-900/30',
    hover: 'hover:border-cyan-300 dark:hover:border-cyan-500',
    hoverBg: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
    text: 'text-cyan-600 dark:text-cyan-400'
  },
];

// Map to store color for each fileId (consistent across reorders)
const fileColorMap = new Map<string, typeof FILE_COLORS[0]>();

const getFileColor = (fileId: string) => {
  if (!fileColorMap.has(fileId)) {
    // Assign color based on current map size (first come, first served)
    const colorIndex = fileColorMap.size % FILE_COLORS.length;
    fileColorMap.set(fileId, FILE_COLORS[colorIndex]);
  }
  return fileColorMap.get(fileId)!;
};

// Sortable File List Item Component
function SortableFileListItem({
  fileObj,
  index,
  totalPages,
  deletedCount,
  onRemove,
  onPreview,
  isProcessing = false,
}: {
  fileObj: FileObject;
  index: number;
  totalPages: number;
  deletedCount: number;
  onRemove: (id: string) => void;
  onPreview: () => void;
  isProcessing?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileObj.id, disabled: isProcessing });

  const fileColor = getFileColor(fileObj.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 bg-white dark:bg-slate-700 rounded-lg border transition-all duration-200 ${
        isDragging
          ? `${fileColor.border} shadow-xl ring-2 ${fileColor.ring} ${fileColor.bgLight} scale-[1.02]`
          : `border-slate-200 dark:border-slate-600 ${fileColor.hover} hover:shadow-md`
      } ${
        isProcessing ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
      } group`}
    >
      <div className="flex items-start gap-3">
        {/* File Color Indicator */}
        <div className={`w-1 h-full min-h-[40px] rounded-full ${fileColor.bg} flex-shrink-0`} />
        
        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mb-1">
            {fileObj.file.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{totalPages} halaman</span>
            {deletedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {deletedCount} dihapus
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div 
          className="flex items-center gap-1 flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Lihat preview"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fileObj.id);
            }}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Hapus file"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrganizeEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fileObjects, setFileObjects] = useState<FileObject[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [downloadFileName, setDownloadFileName] = useState("pdf-organized");
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletedPages, setDeletedPages] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPageNumber, setPreviewPageNumber] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<{ current: number; total: number } | null>(null);
  const [fileErrors, setFileErrors] = useState<Array<{ fileId: string; fileName: string; error: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Extract pages from all files
  const extractPagesFromFiles = async (files: FileObject[], startFileIndex: number = 0): Promise<PageItem[]> => {
    setIsLoadingPages(true);
    const allPages: PageItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        const fileIndex = startFileIndex + i;
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        const url = URL.createObjectURL(fileObj.file);
        const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        // Generate thumbnails for each page
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const scale = 0.6;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            } as any).promise;

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

            const pageId = `${fileObj.id}-page-${pageNum}`;
            allPages.push({
              id: pageId,
              pageNumber: pageNum,
              fileId: fileObj.id,
              fileName: fileObj.file.name,
              fileIndex: fileIndex,
              thumbnailUrl: dataUrl,
              isLoading: false,
            });
          } catch (error) {
            console.warn(`Error generating preview for page ${pageNum}:`, error);
            const pageId = `${fileObj.id}-page-${pageNum}`;
            allPages.push({
              id: pageId,
              pageNumber: pageNum,
              fileId: fileObj.id,
              fileName: fileObj.file.name,
              fileIndex: fileIndex,
              thumbnailUrl: null,
              isLoading: false,
            });
          }
        }

        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error extracting pages:", error);
    }

    setIsLoadingPages(false);
    return allPages;
  };

  // Load files dari sessionStorage dan IndexedDB
  useEffect(() => {
    const loadFiles = async () => {
      const sessionId = searchParams.get("session");
      if (!sessionId) {
        router.push("/organize");
        return;
      }

      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-organize-session-${sessionId}`);
        if (!sessionDataStr) {
          router.push("/organize");
          return;
        }

        const sessionData = JSON.parse(sessionDataStr);
        const fileIds: string[] = sessionData.fileIds || [];

        if (fileIds.length === 0) {
          router.push("/organize");
          return;
        }

        const loadedFiles: FileObject[] = [];
        for (const fileId of fileIds) {
          try {
            const fileMetadataStr = sessionStorage.getItem(`pdf-organize-${fileId}`);
            if (!fileMetadataStr) continue;

            const fileMetadata = JSON.parse(fileMetadataStr);
            const arrayBuffer = await indexedDBManager.getFile(fileId);
            const file = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });

            loadedFiles.push({
              id: fileId,
              file,
            });
          } catch (error) {
            console.error(`Error loading file ${fileId}:`, error);
          }
        }

        if (loadedFiles.length === 0) {
          alert("Tidak ada file yang berhasil dimuat. Redirecting...");
          router.push("/organize");
          return;
        }

        setFileObjects(loadedFiles);
        setIsLoading(false);

        // Extract pages from all files
        const extractedPages = await extractPagesFromFiles(loadedFiles);
        setPages(extractedPages);
      } catch (error) {
        console.error("Error loading files:", error);
        router.push("/organize");
      }
    };

    loadFiles();
  }, [searchParams, router]);

  // Sync file errors dari worker ke fileObjects state
  useEffect(() => {
    if (fileErrors.length > 0) {
      setFileObjects((prev) =>
        prev.map((obj) => {
          const error = fileErrors.find((e) => e.fileId === obj.id);
          return error ? { ...obj, error: error.error } : obj;
        })
      );
    }
  }, [fileErrors]);

  // Handle merge - merge pages in order, excluding deleted pages
  const handleMerge = async () => {
    if (pages.length === 0) return;

    // Filter pages: exclude deleted pages and get pages in current order
    const pagesToMerge = pages.filter((page) => !deletedPages.has(page.id));

    if (pagesToMerge.length === 0) {
      alert("Tidak ada halaman yang akan digabungkan. Semua halaman telah dihapus.");
      return;
    }

    // Reset error state
    setFileObjects((prev) => prev.map((obj) => ({ ...obj, error: undefined, isProcessing: false })));
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setFileErrors([]);
    setCurrentFile(null);

    try {
      const mergedPdf = await PDFDocument.create();
      const totalPages = pagesToMerge.length;

      // Cache untuk menyimpan PDF yang sudah di-load (untuk efisiensi)
      const pdfCache = new Map<string, PDFDocument>();

      // Process pages in exact order as they appear in preview
      let processedCount = 0;
      for (const page of pagesToMerge) {
        const fileObj = fileObjects.find((f) => f.id === page.fileId);
        if (!fileObj) {
          console.warn(`File not found for page ${page.id}`);
          continue;
        }

        try {
          let sourcePdf: PDFDocument;

          // Check cache first
          if (pdfCache.has(page.fileId)) {
            sourcePdf = pdfCache.get(page.fileId)!;
          } else {
            // Get file from IndexedDB
            const arrayBuffer = await indexedDBManager.getFile(page.fileId);
            
            // Load PDF
            sourcePdf = await PDFDocument.load(arrayBuffer, {
              ignoreEncryption: true,
              capNumbers: true,
            });

            // Cache the loaded PDF
            pdfCache.set(page.fileId, sourcePdf);
          }

          // Convert page number (1-based) to index (0-based)
          const pageIndex = page.pageNumber - 1;
          
          // Validate page index
          if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
            throw new Error(`Halaman ${page.pageNumber} tidak valid (total: ${sourcePdf.getPageCount()})`);
          }
          
          // Copy page
          const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageIndex]);
          mergedPdf.addPage(copiedPage);
          
          processedCount++;
          
          // Update progress
          const progressValue = Math.round((processedCount / totalPages) * 100);
          setProgress(progressValue);
          setCurrentFile({ current: processedCount, total: totalPages });
        } catch (pageError) {
          const errorMessage = (pageError as Error).message || "Error tidak diketahui";
          console.warn(`Error pada halaman ${page.pageNumber} dari ${fileObj.file.name}:`, pageError);
          
          // Add to errors but continue
          setFileErrors((prev) => {
            const existing = prev.find((e) => e.fileId === page.fileId);
            if (!existing) {
              return [...prev, { fileId: page.fileId, fileName: fileObj.file.name, error: errorMessage }];
            }
            return prev;
          });
        }
      }

      if (mergedPdf.getPageCount() === 0) {
        throw new Error("Tidak ada halaman yang berhasil digabungkan.");
      }

      // Save merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      // Convert Uint8Array to compatible format for Blob
      const blob = new Blob([mergedPdfBytes as unknown as BlobPart], { type: "application/pdf" });
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error merging pages:", error);
      alert("Error: " + (error as Error).message);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Toggle delete status for a page
  const handleTogglePageDelete = (pageId: string) => {
    if (!deleteMode) return;
    
    setDeletedPages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Handle page preview
  const handlePagePreview = (page: PageItem) => {
    // Find the file object
    const fileObj = fileObjects.find((f) => f.id === page.fileId);
    if (!fileObj) return;

    // Create URL for the PDF file
    const url = URL.createObjectURL(fileObj.file);
    setPreviewUrl(url);
    setPreviewPageNumber(page.pageNumber);
  };

  // Handle page remove
  const handlePageRemove = (pageId: string) => {
    // Remove the page from the list
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    
    // Also remove from deletedPages if it was marked as deleted
    setDeletedPages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(pageId);
      return newSet;
    });
  };

  // Handle file drag end (reorder files)
  // When files are reordered, pages should be reordered to match the new file order
  // while maintaining relative order of pages within each file
  const handleFileDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFileObjects((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Reorder pages to match new file order
        // Group pages by fileId, maintaining their current relative order
        setPages((prevPages) => {
          // Group pages by fileId, preserving their current order in the array
          const pagesByFile = new Map<string, PageItem[]>();
          for (const page of prevPages) {
            if (!pagesByFile.has(page.fileId)) {
              pagesByFile.set(page.fileId, []);
            }
            pagesByFile.get(page.fileId)!.push(page);
          }

          // Rebuild pages array in new file order
          // Pages from each file maintain their relative order as they appear in prevPages
          const reorderedPages: PageItem[] = [];
          for (let i = 0; i < newItems.length; i++) {
            const file = newItems[i];
            const filePages = pagesByFile.get(file.id) || [];
            // Update fileIndex for all pages from this file
            // Maintain the order as they appear in the original array
            for (const page of filePages) {
              reorderedPages.push({ ...page, fileIndex: i });
            }
          }

          return reorderedPages;
        });

        // Update session data
        const sessionId = searchParams.get("session");
        if (sessionId) {
          try {
            const sessionDataStr = sessionStorage.getItem(`pdf-organize-session-${sessionId}`);
            if (sessionDataStr) {
              const sessionData = JSON.parse(sessionDataStr);
              sessionData.fileIds = newItems.map((item) => item.id);
              sessionStorage.setItem(`pdf-organize-session-${sessionId}`, JSON.stringify(sessionData));
            }
          } catch (error) {
            console.error("Error updating session data:", error);
          }
        }

        return newItems;
      });
    }
  };

  // Handle page drag end (reorder pages)
  const handlePageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveFile = async (id: string) => {
    // Get page IDs for this file before removing
    const filePageIds = pages.filter((p) => p.fileId === id).map((p) => p.id);
    
    // Remove file and all its pages
    setFileObjects((prev) => prev.filter((o) => o.id !== id));
    setPages((prev) => prev.filter((p) => p.fileId !== id));
    
    // Remove pages from deletedPages set
    setDeletedPages((prev) => {
      const newSet = new Set(prev);
      filePageIds.forEach((pageId) => newSet.delete(pageId));
      return newSet;
    });

    // Update session data
    const sessionId = searchParams.get("session");
    if (sessionId) {
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-organize-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = sessionData.fileIds.filter((fileId: string) => fileId !== id);
          sessionStorage.setItem(`pdf-organize-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    }

    // Optional: delete from IndexedDB
    try {
      await indexedDBManager.deleteFile(id);
      sessionStorage.removeItem(`pdf-organize-${id}`);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleBack = () => {
    try {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      setDownloadUrl(null);
      setProgress(0);
      setIsProcessing(false);
      setFileErrors([]);
      setCurrentFile(null);
    } catch (error) {
      console.warn("Error during reset:", error);
    }
    router.push("/organize");
  };

  const handleReset = () => {
    setFileObjects([]);
    setPages([]);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
    setProgress(0);
    setIsProcessing(false);
    setFileErrors([]);
    setCurrentFile(null);
    router.push("/organize");
  };

  const handleAddFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      alert("Hanya file PDF yang didukung");
      return;
    }

    const sessionId = searchParams.get("session");
    if (!sessionId) return;

    try {
      const newFileIds: string[] = [];
      const newFiles: FileObject[] = [];

      // Simpan setiap file baru ke IndexedDB
      for (const file of pdfFiles) {
        const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
        await indexedDBManager.saveFile(fileId, file);
        newFileIds.push(fileId);

        const fileMetadata = {
          id: fileId,
          name: file.name,
        };
        sessionStorage.setItem(`pdf-organize-${fileId}`, JSON.stringify(fileMetadata));

        const arrayBuffer = await indexedDBManager.getFile(fileId);
        const fileObj = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });
        newFiles.push({
          id: fileId,
          file: fileObj,
        });
      }

      // Add to state
      const updatedFiles = [...fileObjects, ...newFiles];
      setFileObjects(updatedFiles);

      // Extract pages from new files
      const newPages = await extractPagesFromFiles(newFiles, fileObjects.length);
      setPages((prev) => [...prev, ...newPages]);

      // Update session data
      try {
        const sessionDataStr = sessionStorage.getItem(`pdf-organize-session-${sessionId}`);
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          sessionData.fileIds = [...sessionData.fileIds, ...newFileIds];
          sessionStorage.setItem(`pdf-organize-session-${sessionId}`, JSON.stringify(sessionData));
        }
      } catch (error) {
        console.error("Error updating session data:", error);
      }
    } catch (error) {
      console.error("Error adding files:", error);
      alert("Error menambahkan file. Pastikan browser mendukung IndexedDB dan ada cukup ruang penyimpanan.");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-purple-600 dark:text-purple-400" size={32} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Memuat file...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FDFDFF] dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Organize PDF Editor
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pages.length} halaman dari {fileObjects.length} file
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Page Preview Grid */}
        <div 
          className="flex-1 overflow-y-auto p-4 relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging && !isProcessing && !downloadUrl) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only set dragging to false if we're leaving the main container
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            
            if (isProcessing || downloadUrl) return;
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
              handleAddFiles(files);
            }
          }}
        >
          {/* Drag and Drop Overlay */}
          {isDragging && !isProcessing && !downloadUrl && (
            <div className="absolute inset-0 z-50 bg-purple-500/10 dark:bg-purple-900/30 backdrop-blur-sm border-4 border-dashed border-purple-500 dark:border-purple-400 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="p-6 rounded-full bg-purple-100 dark:bg-purple-900/40 mb-4 mx-auto w-fit">
                  <Plus size={48} className="text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  Lepaskan file di sini untuk menambahkan
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                  File PDF akan ditambahkan dan halamannya diekstrak
                </p>
              </div>
            </div>
          )}
          {!downloadUrl && (
            <>
              {isLoadingPages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-purple-600 dark:text-purple-400" size={32} />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Memuat preview halaman...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        Preview Halaman
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px]">
                          {pages.length - deletedPages.size} / {pages.length}
                        </span>
                      </h3>
                    </div>

                    {deleteMode && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                          Mode Hapus Aktif - Klik halaman untuk menandai sebagai dihapus ({deletedPages.size} halaman ditandai)
                        </p>
                      </div>
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handlePageDragEnd}
                    >
                      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto p-1 custom-scrollbar" style={{ willChange: 'transform' }}>
                          {pages.map((page, index) => {
                            const isDeleted = deletedPages.has(page.id);
                            return (
                              <SortablePageItem
                                key={page.id}
                                page={page}
                                index={index}
                                isProcessing={isProcessing}
                                isDeleted={isDeleted}
                                deleteMode={deleteMode}
                                onToggleDelete={() => handleTogglePageDelete(page.id)}
                                onPreview={() => handlePagePreview(page)}
                                onRemove={() => handlePageRemove(page.id)}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>

                  {/* Processing State */}
                  {isProcessing && (
                    <div className="mb-4">
                      <ProgressBar progress={progress} />
                      {currentFile && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                          Memproses file {currentFile.current} dari {currentFile.total}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Error Messages */}
                  {fileErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                        {fileErrors.length} file memiliki error:
                      </h4>
                      <ul className="space-y-1">
                        {fileErrors.map((error) => (
                          <li key={error.fileId} className="text-xs text-red-700 dark:text-red-400">
                            • <span className="font-medium">{error.fileName}</span>: {error.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Download Results */}
          {downloadUrl && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-pink-50 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300">
                  Berhasil mengatur{" "}
                  <span className="text-purple-600 dark:text-purple-400">
                    {pages.length - deletedPages.size} halaman
                  </span>{" "}
                  menjadi 1 file PDF
                </p>
              </div>

              <DownloadSection
                downloadUrl={downloadUrl}
                fileName={downloadFileName}
                onFileNameChange={setDownloadFileName}
                onReset={handleReset}
              />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Info Section */}
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
                  Cara Menggunakan
                </h3>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Atur urutan halaman dengan drag & drop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Atur urutan file di daftar kanan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Klik tombol "Gabungkan Sekarang"</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">Total Halaman:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{pages.length}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400">Aktif:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {pages.length - deletedPages.size}
                  </span>
                </div>
                {deletedPages.size > 0 && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-400">Dihapus:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{deletedPages.size}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-600 mt-2">
                  <span className="text-slate-600 dark:text-slate-400">Total File:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{fileObjects.length}</span>
                </div>
              </div>
            </div>

            {/* File List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Daftar File
                </h3>
                <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full">
                  {fileObjects.length}
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {fileObjects.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-slate-400 dark:text-slate-500 text-sm">Belum ada file</p>
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter} 
                    onDragEnd={handleFileDragEnd}
                  >
                    <SortableContext 
                      items={fileObjects.map((obj) => obj.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {fileObjects.map((obj, index) => {
                          const filePages = pages.filter((p) => p.fileId === obj.id);
                          const deletedCount = filePages.filter((p) => deletedPages.has(p.id)).length;
                          const totalPages = filePages.length;
                          
                          return (
                            <SortableFileListItem
                              key={obj.id}
                              fileObj={obj}
                              index={index}
                              totalPages={totalPages}
                              deletedCount={deletedCount}
                              onRemove={handleRemoveFile}
                              onPreview={() => {
                                const url = URL.createObjectURL(obj.file);
                                setPreviewUrl(url);
                              }}
                              isProcessing={isProcessing}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>

            {/* Add File Button */}
            {!downloadUrl && (
              <div className="pt-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = ".pdf";
                    input.onchange = (event) => {
                      const target = event.target as HTMLInputElement;
                      if (target.files) {
                        handleAddFiles(Array.from(target.files));
                      }
                    };
                    input.click();
                  }}
                  disabled={isProcessing || isLoadingPages}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500"
                >
                  <Plus size={18} />
                  <span>Tambah File</span>
                </button>
              </div>
            )}

            {/* Delete Mode Toggle */}
            {!downloadUrl && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteMode}
                    onChange={(e) => {
                      setDeleteMode(e.target.checked);
                      if (!e.target.checked) {
                        // Clear deleted pages when exiting delete mode
                        setDeletedPages(new Set());
                      }
                    }}
                    className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                      Mode Hapus Halaman
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      Aktifkan untuk menandai halaman yang akan dihapus
                    </span>
                  </div>
                </label>
                {deleteMode && deletedPages.size > 0 && (
                  <button
                    onClick={() => setDeletedPages(new Set())}
                    className="mt-3 w-full py-2 px-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={14} />
                    Hapus Semua Tanda ({deletedPages.size})
                  </button>
                )}
              </div>
            )}

            {/* Action Button */}
            {!downloadUrl && (
            <div className="pt-3">
              <button
                onClick={handleMerge}
                disabled={isProcessing || (pages.length - deletedPages.size) === 0 || isLoadingPages}
                className="
                  w-full 
                  py-4 
                  px-6 
                  bg-blue-600 
                  dark:bg-blue-500 
                  hover:bg-blue-700 
                  dark:hover:bg-blue-400 
                  text-white 
                  rounded-xl 
                  text-sm 
                  font-semibold 
                  flex 
                  items-center 
                  justify-center 
                  gap-3 
                  transition-all 
                  duration-200 
                  shadow-md 
                  hover:shadow-lg
                  active:scale-[0.98]
                  disabled:bg-slate-100 
                  dark:disabled:bg-slate-800 
                  disabled:text-slate-400 
                  dark:disabled:text-slate-600 
                  disabled:shadow-none 
                  disabled:cursor-not-allowed
                  disabled:active:scale-100
                "
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Menyatukan PDF...</span>
                  </>
                ) : (
                  <>
                    <Zap size={20} className="fill-current" />
                    <span>Gabungkan ({pages.length - deletedPages.size} Halaman)</span>
                  </>
                )}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Preview Dokumen</h3>
                {previewPageNumber && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Halaman {previewPageNumber}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setPreviewPageNumber(null);
                  }
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            {/* Iframe Viewport */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900">
              <iframe 
                src={previewUrl && previewPageNumber 
                  ? `${previewUrl}#page=${previewPageNumber}&toolbar=1&navpanes=0&scrollbar=1&zoom=page-width`
                  : previewUrl || ''} 
                className="w-full h-full border-none" 
                title="PDF Preview" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizeEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#FDFDFF] dark:bg-slate-900">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600 dark:text-purple-400" />
            <p className="text-slate-600 dark:text-slate-400">Memuat editor...</p>
          </div>
        </div>
      }
    >
      <OrganizeEditorContent />
    </Suspense>
  );
}

