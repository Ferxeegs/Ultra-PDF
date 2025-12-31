export interface FileObject {
  id: string;
  file: File;
}

export interface WorkerMessage {
  status: "progress" | "success" | "error";
  data?: any;
  message?: string;
}

