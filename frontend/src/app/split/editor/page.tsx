"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Download, ArrowLeft, Plus, X, List, Hash, ChevronUp, ChevronDown, Crown } from "lucide-react";
import { usePdfSplitWorker } from "@/hooks/usePdfSplitWorker";
import PagePreviewGrid from "@/components/PagePreviewGrid";
import RangePreview from "@/components/RangePreview";
import ProgressBar from "@/components/ProgressBar";
import { indexedDBManager } from "@/utils/indexedDB";

// type SplitMode = "pages" | "custom-range" | "fixed-range";

interface Range {
    start: number;
    end: number;
}

function SplitEditorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    // const [shouldMerge, setShouldMerge] = useState(false);
    const [downloadFileName, setDownloadFileName] = useState("pdf-split");
    const [activeTab, setActiveTab] = useState<"range" | "pages" | "size">("range");
    const [rangeMode, setRangeMode] = useState<"custom" | "fixed">("custom");
    const [customRanges, setCustomRanges] = useState<Range[]>([{ start: 1, end: 2 }]);
    const [fixedRangeSize, setFixedRangeSize] = useState<number>(1);
    const [fileName, setFileName] = useState<string>("");
    const [mergeAllRanges, setMergeAllRanges] = useState<boolean>(false);
    const [mergeSelectedPages, setMergeSelectedPages] = useState<boolean>(false);
    const [rangeInputValues, setRangeInputValues] = useState<{ [key: string]: string }>({});
    const [fixedRangeInputValue, setFixedRangeInputValue] = useState<string>("");

    const {
        isProcessing,
        progress,
        downloadUrl,
        splitResults,
        fileError,
        totalPages,
        currentPage,
        pdfUrl,
        loadPdf,
        processSelectedPages,
        processRanges,
        reset,
    } = usePdfSplitWorker();

    // Load PDF dari sessionStorage atau query params
    useEffect(() => {
        const loadFile = async () => {
            const fileId = searchParams.get("id");
            if (!fileId) {
                router.push("/split");
                return;
            }

            // Ambil file metadata dari sessionStorage
            const fileMetadataStr = sessionStorage.getItem(`pdf-split-${fileId}`);
            if (!fileMetadataStr) {
                router.push("/split");
                return;
            }

            try {
                const fileMetadata = JSON.parse(fileMetadataStr);
                
                // Check if file exists in IndexedDB first
                try {
                    await indexedDBManager.getFile(fileId);
                } catch (error) {
                    // File tidak ada di IndexedDB, redirect tanpa error
                    router.push("/split");
                    return;
                }
                
                // Get file from IndexedDB
                const arrayBuffer = await indexedDBManager.getFile(fileId);
                const file = new File([arrayBuffer], fileMetadata.name, { type: "application/pdf" });
                
                const fileObject = {
                    id: fileId,
                    file,
                };

                setFileName(fileMetadata.name);

                if (!pdfUrl && totalPages === 0) {
                    loadPdf(fileObject);
                }
            } catch (error) {
                console.error("Error loading file:", error);
                // Jangan tampilkan alert, cukup redirect
                router.push("/split");
            }
        };

        loadFile();
        
        // Cleanup function untuk cancel async operations saat unmount
        return () => {
            // Component unmounting, tidak perlu melakukan apa-apa
            // File akan tetap ada di IndexedDB untuk digunakan lagi jika perlu
        };
    }, [searchParams, pdfUrl, totalPages, loadPdf, router]);

    // Generate pages from ranges
    const generatePagesFromRanges = (ranges: Range[]): number[] => {
        const pages = new Set<number>();
        ranges.forEach(range => {
            for (let i = range.start; i <= range.end && i <= totalPages; i++) {
                if (i >= 1) {
                    pages.add(i);
                }
            }
        });
        return Array.from(pages).sort((a, b) => a - b);
    };

    // Generate pages from fixed range
    // const generatePagesFromFixedRange = (): number[] => {
    //     const pages: number[] = [];
    //     for (let i = 1; i <= totalPages; i += fixedRangeSize) {
    //         for (let j = i; j < i + fixedRangeSize && j <= totalPages; j++) {
    //             pages.push(j);
    //         }
    //     }
    //     return pages;
    // };

    const handleProcess = async () => {
        if (activeTab === "range") {
            // Range mode
            if (rangeMode === "custom") {
                const validRanges = customRanges.filter(r => r.start >= 1 && r.end >= r.start && r.start <= totalPages);
                if (validRanges.length === 0) {
                    alert("Tentukan rentang halaman yang valid");
                    return;
                }
                
                if (mergeAllRanges) {
                    // Merge all ranges into one PDF
                    const allPages = generatePagesFromRanges(validRanges);
                    await processSelectedPages(allPages, "merge");
                } else {
                    // Split each range into separate files
                    await processRanges(validRanges, fileName);
                }
            } else {
                // Fixed range mode
                if (fixedRangeSize < 1 || fixedRangeSize > totalPages) {
                    alert("Jumlah halaman per file harus antara 1 dan " + totalPages);
                    return;
                }
                const ranges: Range[] = [];
                for (let i = 1; i <= totalPages; i += fixedRangeSize) {
                    ranges.push({
                        start: i,
                        end: Math.min(i + fixedRangeSize - 1, totalPages)
                    });
                }
                
                if (mergeAllRanges) {
                    // Merge all ranges into one PDF
                    const allPages = generatePagesFromRanges(ranges);
                    await processSelectedPages(allPages, "merge");
                } else {
                    await processRanges(ranges, fileName);
                }
            }
        } else if (activeTab === "pages") {
            // Pages mode
            if (selectedPages.size === 0) {
                alert("Pilih setidaknya satu halaman");
                return;
            }
            const pagesToProcess = Array.from(selectedPages).sort((a, b) => a - b);
            await processSelectedPages(pagesToProcess, mergeSelectedPages ? "merge" : "split");
        } else if (activeTab === "size") {
            // Size mode (premium feature - untuk sekarang sama dengan fixed range)
            if (fixedRangeSize < 1 || fixedRangeSize > totalPages) {
                alert("Jumlah halaman per file harus antara 1 dan " + totalPages);
                return;
            }
            const ranges: Range[] = [];
            for (let i = 1; i <= totalPages; i += fixedRangeSize) {
                ranges.push({
                    start: i,
                    end: Math.min(i + fixedRangeSize - 1, totalPages)
                });
            }
            await processRanges(ranges, fileName);
        }
    };

    const addCustomRange = () => {
        setCustomRanges([...customRanges, { start: 1, end: 1 }]);
    };

    const removeCustomRange = (index: number) => {
        setCustomRanges(customRanges.filter((_, i) => i !== index));
    };

    const updateCustomRange = (index: number, field: "start" | "end", value: number) => {
        const updated = [...customRanges];
        updated[index] = { ...updated[index], [field]: Math.max(1, Math.min(totalPages, value)) };
        // Ensure start <= end
        if (field === "start" && updated[index].start > updated[index].end) {
            updated[index].end = updated[index].start;
        } else if (field === "end" && updated[index].end < updated[index].start) {
            updated[index].start = updated[index].end;
        }
        setCustomRanges(updated);
    };

    const handleRangeInputChange = (index: number, field: "start" | "end", value: string) => {
        const key = `${index}-${field}`;
        // Store the raw input value - don't update state yet
        setRangeInputValues({ ...rangeInputValues, [key]: value });
    };

    const handleRangeInputBlur = (index: number, field: "start" | "end") => {
        const key = `${index}-${field}`;
        const inputValue = rangeInputValues[key];
        
        if (inputValue !== undefined && inputValue !== "") {
            const numValue = parseInt(inputValue, 10);
            if (isNaN(numValue) || numValue < 1) {
                // Reset to current value if invalid
                const currentValue = customRanges[index][field];
                updateCustomRange(index, field, currentValue);
            } else {
                updateCustomRange(index, field, numValue);
            }
        }
        // Clear the temporary input value
        const newValues = { ...rangeInputValues };
        delete newValues[key];
        setRangeInputValues(newValues);
    };

    const getRangeInputValue = (index: number, field: "start" | "end"): string => {
        const key = `${index}-${field}`;
        if (rangeInputValues[key] !== undefined) {
            return rangeInputValues[key];
        }
        return customRanges[index][field].toString();
    };

    const handleFixedRangeInputChange = (value: string) => {
        // Store the raw input value - don't update state yet
        setFixedRangeInputValue(value);
    };

    const handleFixedRangeInputBlur = () => {
        if (fixedRangeInputValue !== "" && fixedRangeInputValue !== undefined) {
            const numValue = parseInt(fixedRangeInputValue, 10);
            if (isNaN(numValue) || numValue < 1) {
                // Reset to current value if invalid
                setFixedRangeSize(fixedRangeSize);
            } else {
                setFixedRangeSize(Math.max(1, Math.min(totalPages, numValue)));
            }
        }
        setFixedRangeInputValue("");
    };

    const getFixedRangeInputValue = (): string => {
        if (fixedRangeInputValue !== "") {
            return fixedRangeInputValue;
        }
        return fixedRangeSize.toString();
    };

    const downloadSinglePage = (result: { pageNumber: number; blob: Blob; fileName: string }) => {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleBack = () => {
        // Hanya reset state, tidak perlu cleanup file karena akan dihapus otomatis
        // atau bisa digunakan lagi jika user kembali
        try {
            reset();
        } catch (error) {
            // Ignore errors saat reset, cukup navigate away
            console.warn("Error during reset:", error);
        }
        router.push("/split");
    };

    if (!pdfUrl && totalPages === 0) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" size={32} />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Memuat PDF...
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
                            Split PDF Editor
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {totalPages} halaman
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content - Full Width Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Preview Grid - Takes remaining space */}
                <div className="flex-1 overflow-y-auto p-6">
                    {pdfUrl && totalPages > 0 && !downloadUrl && splitResults.length === 0 && (
                        <>
                            {activeTab === "pages" ? (
                                <PagePreviewGrid
                                    pdfUrl={pdfUrl}
                                    totalPages={totalPages}
                                    selectedPages={selectedPages}
                                    onSelectionChange={setSelectedPages}
                                />
                            ) : activeTab === "range" ? (
                                <div className="space-y-4">
                                    {/* Info Banner */}
                                    <div className={`rounded-xl p-4 border ${
                                        rangeMode === "custom"
                                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                            : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    }`}>
                                        <h3 className={`text-sm font-bold mb-2 ${
                                            rangeMode === "custom"
                                                ? "text-blue-800 dark:text-blue-300"
                                                : "text-green-800 dark:text-green-300"
                                        }`}>
                                            Mode: {rangeMode === "custom" ? "Rentang Khusus" : "Rentang Tetap"}
                                        </h3>
                                        <p className={`text-xs ${
                                            rangeMode === "custom"
                                                ? "text-blue-700 dark:text-blue-400"
                                                : "text-green-700 dark:text-green-400"
                                        }`}>
                                            {rangeMode === "custom"
                                                ? "Tentukan rentang halaman di sidebar kanan. Setiap rentang akan menjadi file terpisah."
                                                : `Setiap ${fixedRangeSize} halaman akan menjadi 1 file PDF.`}
                                        </p>
                                    </div>

                                    {/* Range Preview */}
                                    <RangePreview
                                        pdfUrl={pdfUrl}
                                        totalPages={totalPages}
                                        ranges={rangeMode === "custom" ? customRanges : []}
                                        fixedRangeSize={rangeMode === "fixed" ? fixedRangeSize : undefined}
                                    />
                                </div>
                            ) : activeTab === "size" ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <Crown size={48} className="mx-auto mb-4 text-amber-500" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                                            Fitur Premium
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            Split berdasarkan ukuran file akan segera hadir.
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}

                    {/* Processing State */}
                    {isProcessing && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <ProgressBar progress={progress} />
                                {currentPage > 0 && selectedPages.size > 0 && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                                        Memproses halaman {currentPage} dari {selectedPages.size}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Download Results */}
                    {downloadUrl && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            {splitResults.length > 1 ? (
                                // Split mode
                                <>
                                    <div className="bg-gradient-to-r from-green-50 dark:from-green-900/20 to-emerald-50 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                                        <p className="text-sm font-bold text-green-800 dark:text-green-300">
                                            Berhasil memisahkan PDF menjadi{" "}
                                            <span className="text-green-600 dark:text-green-400">
                                                {splitResults.length} file
                                            </span>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                            Download Semua (ZIP)
                                        </label>
                                        <a
                                            href={downloadUrl}
                                            download={`${downloadFileName || "pdf-split"}.zip`}
                                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 dark:hover:from-green-600 dark:hover:to-emerald-600 transition-all shadow-lg"
                                        >
                                            <Download size={20} />
                                            Unduh Semua sebagai ZIP
                                        </a>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                            Atau Download Satu per Satu
                                        </label>
                                        <div className="max-h-96 overflow-y-auto space-y-2">
                                            {splitResults.map((result) => (
                                                <button
                                                    key={result.pageNumber}
                                                    onClick={() => downloadSinglePage(result)}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-left flex items-center justify-between group transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                {result.pageNumber}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                            {result.fileName}
                                                        </span>
                                                    </div>
                                                    <Download size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Merge mode
                                <>
                                    <div className="bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                            Berhasil menggabungkan{" "}
                                            <span className="text-blue-600 dark:text-blue-400">
                                                {selectedPages.size} halaman
                                            </span>{" "}
                                            menjadi 1 file PDF
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                            Nama File
                                            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                                                (tanpa ekstensi .pdf)
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={downloadFileName}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^a-zA-Z0-9\s\-_]/g, "");
                                                setDownloadFileName(value);
                                            }}
                                            className="w-full px-4 py-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium transition-all mb-4"
                                            placeholder="pdf-merged"
                                        />
                                        <a
                                            href={downloadUrl}
                                            download={`${downloadFileName || "pdf-merged"}.pdf`}
                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all shadow-lg"
                                        >
                                            <Download size={20} />
                                            Unduh PDF
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Sidebar - Fixed Width */}
                <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        {/* Tabs */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* Tab: Rentang */}
                            <button
                                onClick={() => {
                                    setActiveTab("range");
                                    // Clear page selection when switching to range mode
                                    setSelectedPages(new Set());
                                    // Reset merge state for pages
                                    setMergeSelectedPages(false);
                                }}
                                className={`relative p-3 rounded-xl border-2 transition-all ${
                                    activeTab === "range"
                                        ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                            >
                                {activeTab === "range" && (
                                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-green-500 dark:bg-green-400 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`p-2 rounded-lg ${
                                        activeTab === "range"
                                            ? "bg-green-100 dark:bg-green-900/30"
                                            : "bg-slate-100 dark:bg-slate-700"
                                    }`}>
                                        <Hash size={20} className={activeTab === "range" ? "text-green-600 dark:text-green-400" : "text-slate-400"} />
                                    </div>
                                    <span className={`text-xs font-semibold ${
                                        activeTab === "range"
                                            ? "text-green-700 dark:text-green-300"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}>
                                        Rentang
                                    </span>
                                </div>
                            </button>

                            {/* Tab: Halaman */}
                            <button
                                onClick={() => {
                                    setActiveTab("pages");
                                    // Clear range input values when switching to pages mode
                                    setRangeInputValues({});
                                    // Reset merge state for ranges
                                    setMergeAllRanges(false);
                                }}
                                className={`relative p-3 rounded-xl border-2 transition-all ${
                                    activeTab === "pages"
                                        ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                            >
                                {activeTab === "pages" && (
                                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-green-500 dark:bg-green-400 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`p-2 rounded-lg ${
                                        activeTab === "pages"
                                            ? "bg-green-100 dark:bg-green-900/30"
                                            : "bg-slate-100 dark:bg-slate-700"
                                    }`}>
                                        <List size={20} className={activeTab === "pages" ? "text-green-600 dark:text-green-400" : "text-slate-400"} />
                                    </div>
                                    <span className={`text-xs font-semibold ${
                                        activeTab === "pages"
                                            ? "text-green-700 dark:text-green-300"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}>
                                        Halaman
                                    </span>
                                </div>
                            </button>

                            {/* Tab: Ukuran */}
                            {/* <button
                                onClick={() => setActiveTab("size")}
                                className={`relative p-3 rounded-xl border-2 transition-all ${
                                    activeTab === "size"
                                        ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                            >
                                {activeTab === "size" && (
                                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-green-500 dark:bg-green-400 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`relative p-2 rounded-lg ${
                                        activeTab === "size"
                                            ? "bg-green-100 dark:bg-green-900/30"
                                            : "bg-slate-100 dark:bg-slate-700"
                                    }`}>
                                        <Hash size={20} className={activeTab === "size" ? "text-green-600 dark:text-green-400" : "text-slate-400"} />
                                        <Crown size={10} className="absolute -top-1 -right-1 text-amber-500" />
                                    </div>
                                    <span className={`text-xs font-semibold ${
                                        activeTab === "size"
                                            ? "text-green-700 dark:text-green-300"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}>
                                        Ukuran
                                    </span>
                                </div>
                            </button> */}
                        </div>

                        {/* Content berdasarkan Tab */}
                        {activeTab === "range" && (
                            <div className="space-y-4">
                                {/* Mode Rentang */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                        Mode rentang:
                                    </h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setRangeMode("custom")}
                                            className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-semibold text-sm transition-all ${
                                                rangeMode === "custom"
                                                    ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                                            }`}
                                        >
                                            Rentang khusus
                                        </button>
                                        <button
                                            onClick={() => setRangeMode("fixed")}
                                            className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-semibold text-sm transition-all ${
                                                rangeMode === "fixed"
                                                    ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                                            }`}
                                        >
                                            Rentang tetap
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Range Inputs */}
                                {rangeMode === "custom" && (
                                    <div className="space-y-3">
                                        {customRanges.map((range, index) => (
                                            <div key={index} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                            Rentang {index + 1}
                                                        </span>
                                                        <ChevronUp size={16} className="text-slate-400" />
                                                    </div>
                                                    {customRanges.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                // Clear any temp input values for this range
                                                                const startKey = `${index}-start`;
                                                                const endKey = `${index}-end`;
                                                                const newValues = { ...rangeInputValues };
                                                                delete newValues[startKey];
                                                                delete newValues[endKey];
                                                                setRangeInputValues(newValues);
                                                                // Remove the range
                                                                removeCustomRange(index);
                                                            }}
                                                            className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Hapus rentang"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                            dari halaman
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={getRangeInputValue(index, "start")}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Allow empty, numbers, and single minus
                                                                    if (value === "" || /^-?\d*$/.test(value)) {
                                                                        handleRangeInputChange(index, "start", value);
                                                                    }
                                                                }}
                                                                onBlur={() => handleRangeInputBlur(index, "start")}
                                                                className="w-full px-3 py-2.5 text-base border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                                                            />
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        updateCustomRange(index, "start", Math.min(totalPages, range.start + 1));
                                                                        // Clear temp value to show updated value
                                                                        const key = `${index}-start`;
                                                                        const newValues = { ...rangeInputValues };
                                                                        delete newValues[key];
                                                                        setRangeInputValues(newValues);
                                                                    }}
                                                                    onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                                    tabIndex={-1} // Prevent tab focus
                                                                >
                                                                    <ChevronUp size={12} className="text-slate-500" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        updateCustomRange(index, "start", Math.max(1, range.start - 1));
                                                                        // Clear temp value to show updated value
                                                                        const key = `${index}-start`;
                                                                        const newValues = { ...rangeInputValues };
                                                                        delete newValues[key];
                                                                        setRangeInputValues(newValues);
                                                                    }}
                                                                    onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                                    tabIndex={-1} // Prevent tab focus
                                                                >
                                                                    <ChevronDown size={12} className="text-slate-500" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-6">
                                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">ke</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                            &nbsp;
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={getRangeInputValue(index, "end")}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Allow empty, numbers, and single minus
                                                                    if (value === "" || /^-?\d*$/.test(value)) {
                                                                        handleRangeInputChange(index, "end", value);
                                                                    }
                                                                }}
                                                                onBlur={() => handleRangeInputBlur(index, "end")}
                                                                onKeyDown={(e) => {
                                                                    // Allow Enter key to trigger blur
                                                                    if (e.key === "Enter") {
                                                                        e.currentTarget.blur();
                                                                    }
                                                                    // Allow Tab to move to next field
                                                                    if (e.key === "Tab") {
                                                                        // Let default behavior happen
                                                                    }
                                                                }}
                                                                className="w-full px-3 py-2.5 text-base border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400"
                                                            />
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        updateCustomRange(index, "end", Math.min(totalPages, range.end + 1));
                                                                        // Clear temp value to show updated value
                                                                        const key = `${index}-end`;
                                                                        const newValues = { ...rangeInputValues };
                                                                        delete newValues[key];
                                                                        setRangeInputValues(newValues);
                                                                    }}
                                                                    onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                                    tabIndex={-1} // Prevent tab focus
                                                                >
                                                                    <ChevronUp size={12} className="text-slate-500" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        updateCustomRange(index, "end", Math.max(range.start, range.end - 1));
                                                                        // Clear temp value to show updated value
                                                                        const key = `${index}-end`;
                                                                        const newValues = { ...rangeInputValues };
                                                                        delete newValues[key];
                                                                        setRangeInputValues(newValues);
                                                                    }}
                                                                    onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                                    tabIndex={-1} // Prevent tab focus
                                                                >
                                                                    <ChevronDown size={12} className="text-slate-500" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={addCustomRange}
                                            className="w-full py-2.5 px-4 bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} />
                                            Tambahkan Rentang
                                        </button>
                                    </div>
                                )}

                                {/* Fixed Range Input */}
                                {rangeMode === "fixed" && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                Halaman per File:
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={getFixedRangeInputValue()}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        // Allow empty, numbers, and single minus
                                                        if (value === "" || /^-?\d*$/.test(value)) {
                                                            handleFixedRangeInputChange(value);
                                                        }
                                                    }}
                                                    onBlur={handleFixedRangeInputBlur}
                                                    onKeyDown={(e) => {
                                                        // Allow Enter key to trigger blur
                                                        if (e.key === "Enter") {
                                                            e.currentTarget.blur();
                                                        }
                                                        // Allow arrow keys for navigation
                                                        if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const newValue = Math.min(totalPages, fixedRangeSize + 1);
                                                            setFixedRangeSize(newValue);
                                                            setFixedRangeInputValue("");
                                                        } else if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const newValue = Math.max(1, fixedRangeSize - 1);
                                                            setFixedRangeSize(newValue);
                                                            setFixedRangeInputValue("");
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2.5 text-base border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400"
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const newValue = Math.min(totalPages, fixedRangeSize + 1);
                                                            setFixedRangeSize(newValue);
                                                            setFixedRangeInputValue(""); // Clear temp value to show new value
                                                        }}
                                                        onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                        tabIndex={-1} // Prevent tab focus
                                                    >
                                                        <ChevronUp size={12} className="text-slate-500" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const newValue = Math.max(1, fixedRangeSize - 1);
                                                            setFixedRangeSize(newValue);
                                                            setFixedRangeInputValue(""); // Clear temp value to show new value
                                                        }}
                                                        onMouseDown={(e) => e.preventDefault()} // Prevent input focus loss
                                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                                                        tabIndex={-1} // Prevent tab focus
                                                    >
                                                        <ChevronDown size={12} className="text-slate-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Checkbox: Gabungkan semua rentang */}
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={mergeAllRanges}
                                        onChange={(e) => setMergeAllRanges(e.target.checked)}
                                        className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Gabungkan semua rentang dalam satu file PDF.
                                    </span>
                                </label>
                            </div>
                        )}

                        {activeTab === "pages" && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Pilih halaman secara manual dari preview di sebelah kiri.
                                </p>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Dipilih:</span>
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedPages.size} halaman</span>
                                    </div>
                                </div>
                                
                                {/* Checkbox: Gabungkan halaman yang dipilih */}
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={mergeSelectedPages}
                                        onChange={(e) => setMergeSelectedPages(e.target.checked)}
                                        className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Gabungkan halaman yang dipilih dalam satu file PDF.
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* {activeTab === "size" && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                                    <Crown size={16} />
                                    <span className="text-sm font-semibold">Fitur Premium</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Split berdasarkan ukuran file akan segera hadir.
                                </p>
                            </div>
                        )} */}

                        {/* Error Messages */}
                        {fileError && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                                    Error:
                                </h4>
                                <p className="text-xs text-red-700 dark:text-red-400">{fileError}</p>
                            </div>
                        )}

                        {/* Action Button */}
                        {!downloadUrl && (
                            <div className="pt-4">
                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing || (
                                        activeTab === "range" ? (rangeMode === "custom" ? customRanges.length === 0 : fixedRangeSize < 1) :
                                        activeTab === "pages" ? selectedPages.size === 0 :
                                        false
                                    )}
                                    className="w-full py-4 bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Memproses...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>
                                                {activeTab === "pages" && mergeSelectedPages
                                                    ? "Gabungkan PDF"
                                                    : activeTab === "range" && mergeAllRanges
                                                    ? "Gabungkan PDF"
                                                    : "Pisahkan PDF"}
                                            </span>
                                            <ArrowLeft size={20} className="rotate-180" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SplitEditorPage() {
    return (
        <Suspense
            fallback={
                <div className="h-screen flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-slate-600 dark:text-slate-400">Memuat editor...</p>
                    </div>
                </div>
            }
        >
            <SplitEditorContent />
        </Suspense>
    );
}

