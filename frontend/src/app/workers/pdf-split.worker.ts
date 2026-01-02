import { PDFDocument } from 'pdf-lib';

interface WorkerMessageData {
  action?: "load" | "split" | "merge" | "split-ranges";
  id?: string;
  fileName?: string;
  arrayBuffer: ArrayBuffer;
  selectedPages?: number[];
  ranges?: Array<{ start: number; end: number }>;
}

/**
 * Validasi dan sanitasi PDF
 * Mencoba memperbaiki PDF yang rusak dengan cara rebuild struktur dasar
 */
async function sanitizePdf(arrayBuffer: ArrayBuffer, fileName: string): Promise<PDFDocument> {
  try {
    // Percobaan 1: Load Standar
    return await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: false,
      capNumbers: true,
    });
  } catch (error) {
    try {
      // Percobaan 2: Lebih permisif (ignore encryption)
      return await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        capNumbers: true,
      });
    } catch (repairError) {
      // Percobaan 3: Manual Rebuild
      try {
        const sourcePdf = await PDFDocument.load(arrayBuffer, {
          capNumbers: true,
          ignoreEncryption: true,
        });

        const newPdf = await PDFDocument.create();
        const pageIndices = sourcePdf.getPageIndices();

        for (const pageIndex of pageIndices) {
          try {
            const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
            newPdf.addPage(copiedPage);
          } catch (e) {
            console.warn(`Halaman ${pageIndex + 1} korup di ${fileName}`);
          }
        }
        return newPdf;
      } catch (finalError) {
        throw new Error(`File "${fileName}" rusak parah dan tidak bisa diperbaiki.`);
      }
    }
  }
}

addEventListener('message', async (event: MessageEvent) => {
  const messageData: WorkerMessageData = event.data;
  
  if (!messageData || !messageData.arrayBuffer) {
    postMessage({ 
      status: 'error', 
      message: 'Tidak ada file yang diberikan' 
    });
    return;
  }

  const action = messageData.action || "split";
  const fileName = messageData.fileName || "document.pdf";
  const selectedPages = messageData.selectedPages || [];
  const ranges = messageData.ranges || [];

  try {
    // Sanitasi dan load PDF
    const pdf = await sanitizePdf(messageData.arrayBuffer, fileName);
    const pageIndices = pdf.getPageIndices();
    const totalPages = pageIndices.length;

    if (totalPages === 0) {
      postMessage({ 
        status: 'error', 
        message: 'PDF tidak memiliki halaman' 
      });
      return;
    }

    // Action: Load - hanya return total pages
    if (action === "load") {
      postMessage({ 
        status: 'pdf-loaded', 
        data: totalPages,
      });
      return;
    }

    // Action: Split Ranges - split berdasarkan ranges (setiap range = 1 file)
    if (action === "split-ranges") {
      if (ranges.length === 0) {
        postMessage({ 
          status: 'error', 
          message: 'Tidak ada rentang yang diberikan' 
        });
        return;
      }

      const splitPdfs: Uint8Array[] = [];

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const startPage = Math.max(1, Math.min(range.start, totalPages));
        const endPage = Math.max(startPage, Math.min(range.end, totalPages));
        
        // Kirim progress
        const progress = Math.round(((i + 1) / ranges.length) * 100);
        postMessage({ 
          status: 'progress', 
          data: progress,
          currentFile: i + 1,
          totalFiles: ranges.length,
        });

        try {
          // Buat PDF baru untuk range ini
          const newPdf = await PDFDocument.create();
          
          // Copy semua halaman dalam range
          for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            const pageIndex = pageNum - 1; // Convert to 0-based
            try {
              const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
              newPdf.addPage(copiedPage);
            } catch (pageError) {
              console.warn(`Error pada halaman ${pageNum}:`, pageError);
            }
          }
          
          // Simpan PDF sebagai Uint8Array
          const pdfBytes = await newPdf.save();
          splitPdfs.push(pdfBytes);
        } catch (rangeError) {
          console.warn(`Error pada rentang ${startPage}-${endPage}:`, rangeError);
        }
      }

      if (splitPdfs.length === 0) {
        postMessage({ 
          status: 'error', 
          message: 'Tidak ada rentang yang berhasil di-split' 
        });
        return;
      }

      // Kirim hasil split
      postMessage({ 
        status: 'success', 
        data: splitPdfs,
        message: `${splitPdfs.length} file berhasil dibuat`,
      }, { transfer: splitPdfs.map(pdf => pdf.buffer) });
      return;
    }

    // Validasi selected pages (untuk action split dan merge)
    if (selectedPages.length === 0) {
      postMessage({ 
        status: 'error', 
        message: 'Tidak ada halaman yang dipilih' 
      });
      return;
    }

    // Validasi page numbers (1-based to 0-based index)
    const validPageIndices = selectedPages
      .filter(pageNum => pageNum >= 1 && pageNum <= totalPages)
      .map(pageNum => pageNum - 1); // Convert to 0-based index

    if (validPageIndices.length === 0) {
      postMessage({ 
        status: 'error', 
        message: 'Tidak ada halaman yang valid' 
      });
      return;
    }

    // Action: Merge - gabungkan selected pages menjadi 1 PDF
    if (action === "merge") {
      const mergedPdf = await PDFDocument.create();
      
      for (let i = 0; i < validPageIndices.length; i++) {
        const pageIndex = validPageIndices[i];
        
        // Kirim progress
        const progress = Math.round(((i + 1) / validPageIndices.length) * 100);
        postMessage({ 
          status: 'progress', 
          data: progress,
          currentFile: i + 1,
          totalFiles: validPageIndices.length,
        });

        try {
          const [copiedPage] = await mergedPdf.copyPages(pdf, [pageIndex]);
          mergedPdf.addPage(copiedPage);
        } catch (pageError) {
          console.warn(`Error pada halaman ${pageIndex + 1}:`, pageError);
        }
      }

      const mergedPdfBytes = await mergedPdf.save();
      postMessage({ 
        status: 'success', 
        data: mergedPdfBytes,
        message: `${validPageIndices.length} halaman berhasil digabungkan`,
      }, { transfer: [mergedPdfBytes.buffer] });
      return;
    }

    // Action: Split - split selected pages menjadi file terpisah
    if (action === "split") {
      const splitPdfs: Uint8Array[] = [];

      for (let i = 0; i < validPageIndices.length; i++) {
        const pageIndex = validPageIndices[i];
        const originalPageNum = selectedPages[i];
        
        // Kirim progress
        const progress = Math.round(((i + 1) / validPageIndices.length) * 100);
        postMessage({ 
          status: 'progress', 
          data: progress,
          currentFile: i + 1,
          totalFiles: validPageIndices.length,
        });

        try {
          // Buat PDF baru untuk halaman ini
          const newPdf = await PDFDocument.create();
          
          // Copy halaman ke PDF baru
          const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
          newPdf.addPage(copiedPage);
          
          // Simpan PDF sebagai Uint8Array
          const pdfBytes = await newPdf.save();
          splitPdfs.push(pdfBytes);
        } catch (pageError) {
          console.warn(`Error pada halaman ${originalPageNum}:`, pageError);
        }
      }

      if (splitPdfs.length === 0) {
        postMessage({ 
          status: 'error', 
          message: 'Tidak ada halaman yang berhasil di-split' 
        });
        return;
      }

      // Kirim hasil split
      postMessage({ 
        status: 'success', 
        data: splitPdfs,
        message: `${splitPdfs.length} halaman berhasil di-split`,
      }, { transfer: splitPdfs.map(pdf => pdf.buffer) });
      return;
    }

  } catch (error) {
    postMessage({ 
      status: 'error', 
      message: `Error saat memproses PDF: ${(error as Error).message}`,
    });
  }
});

