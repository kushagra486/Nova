"use client";

import { useRef } from "react";
import { FileText, Upload, X } from "lucide-react";

export interface AttachedFile {
  name: string;
  base64: string;
  sizeBytes: number;
}

const MAX_BYTES = 3 * 1024 * 1024; // matches the server-side pdf-extract.ts limit

interface PdfAttachmentProps {
  file: AttachedFile | null;
  onChange: (file: AttachedFile | null) => void;
  onError: (message: string) => void;
}

export function PdfAttachment({ file, onChange, onError }: PdfAttachmentProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      onError("Only PDF files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      onError(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_BYTES / 1024 / 1024}MB.`);
      return;
    }
    const buffer = await f.arrayBuffer();
    const base64 = btoa(new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ""));
    onChange({ name: f.name, base64, sizeBytes: f.size });
  }

  if (file) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
        <FileText className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">{file.name}</span>
        <span className="text-emerald-400/60">{(file.sizeBytes / 1024).toFixed(0)}KB</span>
        <button
          onClick={() => onChange(null)}
          className="cursor-pointer text-emerald-400/60 transition-colors hover:text-emerald-300"
          aria-label="Remove attached file"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300"
      >
        <Upload className="h-3 w-3" />
        Attach PDF
      </button>
    </>
  );
}
