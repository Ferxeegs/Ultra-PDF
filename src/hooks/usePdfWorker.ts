import { useEffect, useRef, useState } from "react";
import { WorkerMessage } from "@/types";

export function usePdfWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../app/workers/pdf.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { status, data, message } = event.data;
      
      if (status === "progress") {
        setProgress(data);
      } else if (status === "success") {
        const blob = new Blob([data], { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setIsProcessing(false);
        setProgress(100);
      } else if (status === "error") {
        alert("Error: " + message);
        setIsProcessing(false);
        setProgress(0);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const mergeFiles = async (files: File[]) => {
    if (files.length < 2) return;
    
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);

    const fileBuffers = await Promise.all(
      files.map((file) => file.arrayBuffer())
    );
    workerRef.current?.postMessage(fileBuffers);
  };

  const reset = () => {
    setDownloadUrl(null);
    setProgress(0);
    setIsProcessing(false);
  };

  return {
    isProcessing,
    progress,
    downloadUrl,
    mergeFiles,
    reset,
  };
}

