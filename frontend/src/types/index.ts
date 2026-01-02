export interface FileObject {
  id: string;
  file: File;
  error?: string; // Error message jika file ini bermasalah
  isProcessing?: boolean; // Status processing file ini
}

export interface WorkerMessage {
  status: "progress" | "success" | "error" | "file-error" | "file-progress" | "page-progress" | "pdf-loaded";
  data?: any;
  message?: string;
  fileId?: string; // ID file yang bermasalah
  fileName?: string; // Nama file yang bermasalah
  currentFile?: number; // File yang sedang diproses atau halaman yang sedang diproses
  totalFiles?: number; // Total file atau total halaman
}

export interface FileError {
  fileId: string;
  fileName: string;
  error: string;
}

