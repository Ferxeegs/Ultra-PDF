export interface FileObject {
  id: string;
  file: File;
  error?: string; // Error message jika file ini bermasalah
  isProcessing?: boolean; // Status processing file ini
}

export interface WorkerMessage {
  status: "progress" | "success" | "error" | "file-error" | "file-progress";
  data?: any;
  message?: string;
  fileId?: string; // ID file yang bermasalah
  fileName?: string; // Nama file yang bermasalah
  currentFile?: number; // File yang sedang diproses
  totalFiles?: number; // Total file
}

export interface FileError {
  fileId: string;
  fileName: string;
  error: string;
}

