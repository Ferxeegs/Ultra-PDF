import { PDFDocument } from 'pdf-lib';

addEventListener('message', async (event: MessageEvent) => {
  const fileBuffers: ArrayBuffer[] = event.data;
  
  try {
    const mergedPdf = await PDFDocument.create();
    const totalFiles = fileBuffers.length;

    for (let i = 0; i < totalFiles; i++) {
      const pdf = await PDFDocument.load(fileBuffers[i]);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      
      // Kirim progress ke UI thread
      const progress = Math.round(((i + 1) / totalFiles) * 100);
      postMessage({ status: 'progress', data: progress });
    }

    const mergedPdfBytes = await mergedPdf.save();
    postMessage({ status: 'success', data: mergedPdfBytes }, { transfer: [mergedPdfBytes.buffer] });
  } catch (error) {
    postMessage({ status: 'error', message: (error as Error).message });
  }
});