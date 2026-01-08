// Global PDF.js configuration
// Initialize worker once for the entire application (client-side only)

// PDF Document Cache - stores loaded PDF documents by fileId
// This prevents loading the same PDF multiple times
const pdfDocCache: Record<string, Promise<any>> = {};
const pdfDocInstances: Record<string, any> = {};

// Lazy load PDF.js only in browser environment
let pdfjsLib: any = null;
let isInitialized = false;

async function getPdfjsLib() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environment');
  }

  if (!isInitialized) {
    pdfjsLib = await import("pdfjs-dist");
    const version = pdfjsLib.version || "5.4.530";
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    isInitialized = true;
  }

  return pdfjsLib;
}

/**
 * Get or load PDF document from cache
 * @param fileId - Unique identifier for the file
 * @param file - File object to load if not in cache
 * @returns Promise that resolves to PDF document
 */
export async function getPdfDocument(fileId: string, file: File): Promise<any> {
  // If already loaded, return the cached instance
  if (fileId in pdfDocInstances && pdfDocInstances[fileId]) {
    return pdfDocInstances[fileId];
  }

  // If currently loading, return the existing promise
  if (fileId in pdfDocCache) {
    return pdfDocCache[fileId];
  }

  // Start loading the PDF
  const loadPromise = (async () => {
    try {
      const pdfjs = await getPdfjsLib();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer, 
        verbosity: 0 
      });
      const pdf = await loadingTask.promise;
      
      // Store the instance
      pdfDocInstances[fileId] = pdf;
      
      // Remove from loading cache
      delete pdfDocCache[fileId];
      
      return pdf;
    } catch (error) {
      // Remove from cache on error
      delete pdfDocCache[fileId];
      throw error;
    }
  })();

  // Store the promise while loading
  pdfDocCache[fileId] = loadPromise;
  
  return loadPromise;
}

/**
 * Clear PDF document from cache
 * @param fileId - Unique identifier for the file
 */
export function clearPdfDocument(fileId: string): void {
  const pdf = pdfDocInstances[fileId];
  if (pdf) {
    pdf.destroy?.();
    delete pdfDocInstances[fileId];
  }
  delete pdfDocCache[fileId];
}

/**
 * Clear all PDF documents from cache
 */
export function clearAllPdfDocuments(): void {
  Object.keys(pdfDocInstances).forEach(fileId => {
    clearPdfDocument(fileId);
  });
}

// Export function to get pdfjsLib (lazy loaded) - for external use
export async function getPdfjsLibExport() {
  return await getPdfjsLib();
}

