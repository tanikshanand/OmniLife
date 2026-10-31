"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.docx,.txt,.md,.markdown,.json,.log";

export function UploadDropzone({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    onFiles(Array.from(fileList));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition",
        dragging
          ? "border-slate-900 bg-slate-100 dark:border-white dark:bg-white/10"
          : "border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 dark:border-neutral-800 dark:bg-[#0a0a0a] dark:hover:border-neutral-600"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 border border-slate-200 shadow-xs dark:bg-neutral-900 dark:text-white dark:border-transparent">
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-200">
        {uploading ? "Indexing your documents..." : "Drop files to index"}
      </p>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        PDF, DOCX, TXT, Markdown or JSON. OmniLife chunks the text, embeds it and
        extracts entities into your knowledge graph.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-800 dark:border-white/20 dark:bg-white dark:text-black dark:hover:bg-neutral-200 disabled:opacity-50 cursor-pointer"
      >
        <FileUp className="h-3.5 w-3.5" />
        Choose files
      </button>
    </div>
  );
}
