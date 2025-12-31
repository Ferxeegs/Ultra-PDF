import { PDFDocument } from 'pdf-lib';

interface FileData {
  id: string;
  fileName: string;
  arrayBuffer: ArrayBuffer;
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
      capNumbers: true, // Memperbaiki angka koordinat yang tidak valid
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
      // memproses buffer dengan opsi default yang paling stabil.
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
  const files: FileData[] = event.data;
  
  if (!Array.isArray(files) || files.length === 0) {
    postMessage({ 
      status: 'error', 
      message: 'Tidak ada file yang diberikan' 
    });
    return;
  }

  const mergedPdf = await PDFDocument.create();
  const totalFiles = files.length;
  const fileErrors: Array<{ fileId: string; fileName: string; error: string }> = [];
  let successCount = 0;

  for (let i = 0; i < totalFiles; i++) {
    const fileData = files[i];
    
    try {
      // Kirim progress per file
      postMessage({ 
        status: 'file-progress',
        currentFile: i + 1,
        totalFiles: totalFiles,
        fileId: fileData.id,
        fileName: fileData.fileName,
      });

      // Sanitasi dan load PDF
      const pdf = await sanitizePdf(fileData.arrayBuffer, fileData.fileName);
      
      // Copy pages dengan error handling per halaman
      const pageIndices = pdf.getPageIndices();
      let copiedPagesCount = 0;
      
      for (const pageIndex of pageIndices) {
        try {
          const [copiedPage] = await mergedPdf.copyPages(pdf, [pageIndex]);
          mergedPdf.addPage(copiedPage);
          copiedPagesCount++;
        } catch (pageError) {
          // Log error per halaman tapi lanjutkan
          console.warn(
            `Error pada halaman ${pageIndex + 1} dari ${fileData.fileName}:`,
            pageError
          );
        }
      }
      
      if (copiedPagesCount === 0) {
        throw new Error('Tidak ada halaman yang berhasil disalin');
      }
      
      successCount++;
      
      // Kirim progress keseluruhan
      const progress = Math.round(((i + 1) / totalFiles) * 100);
      postMessage({ 
        status: 'progress', 
        data: progress,
        currentFile: i + 1,
        totalFiles: totalFiles,
      });
      
    } catch (error) {
      // Error per file - tidak menghentikan proses
      const errorMessage = (error as Error).message || 'Error tidak diketahui';
      fileErrors.push({
        fileId: fileData.id,
        fileName: fileData.fileName,
        error: errorMessage,
      });
      
      // Kirim error per file ke UI
      postMessage({
        status: 'file-error',
        fileId: fileData.id,
        fileName: fileData.fileName,
        message: errorMessage,
      });
      
      // Tetap update progress meskipun file ini error
      const progress = Math.round(((i + 1) / totalFiles) * 100);
      postMessage({ 
        status: 'progress', 
        data: progress,
        currentFile: i + 1,
        totalFiles: totalFiles,
      });
    }
  }

  // Cek apakah ada file yang berhasil diproses
  if (mergedPdf.getPageCount() === 0) {
    postMessage({ 
      status: 'error', 
      message: 'Tidak ada file yang berhasil diproses. Semua file memiliki error atau tidak memiliki halaman.',
      data: fileErrors,
    });
    return;
  }

  // Jika ada error tapi masih ada file yang berhasil, tetap lanjutkan
  if (fileErrors.length > 0 && successCount > 0) {
    postMessage({
      status: 'error',
      message: `${fileErrors.length} file memiliki error, tetapi ${successCount} file berhasil digabungkan.`,
      data: fileErrors,
    });
  }

  try {
    const mergedPdfBytes = await mergedPdf.save();
    postMessage({ 
      status: 'success', 
      data: mergedPdfBytes,
      message: fileErrors.length > 0 
        ? `${successCount} file berhasil digabungkan. ${fileErrors.length} file dilewati karena error.`
        : undefined,
    }, { transfer: [mergedPdfBytes.buffer] });
  } catch (error) {
    postMessage({ 
      status: 'error', 
      message: `Error saat menyimpan PDF gabungan: ${(error as Error).message}`,
      data: fileErrors,
    });
  }
});