"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  Vault,
} from "lucide-react";

import { UploadDropzone } from "@/components/memory/upload-dropzone";
import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  apiErrorMessage,
  memoryApi,
} from "@/lib/api";
import type {
  DocumentItem,
  MemoryChunk,
  MemoryStats,
  PaginatedChunks,
} from "@/types";
import { cn, formatDate, relativeTime } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTone(extension: string): string {
  if (extension === "pdf")
    return "text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-transparent";
  if (extension === "docx")
    return "text-cyan-700 bg-cyan-50 border border-cyan-200 dark:text-cyan-300 dark:bg-cyan-500/10 dark:border-transparent";
  if (extension === "md" || extension === "markdown")
    return "text-slate-900 bg-slate-100 border border-slate-200 dark:text-white dark:bg-white/10 dark:border-transparent";
  return "text-slate-700 bg-slate-100 border border-slate-200 dark:text-slate-300 dark:bg-slate-800/70 dark:border-transparent";
}

function entityCount(entities: Record<string, unknown>): number {
  let count = 0;
  for (const value of Object.values(entities || {})) {
    if (Array.isArray(value)) count += value.length;
    else if (value) count += 1;
  }
  return count;
}

export default function MemoryPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [chunks, setChunks] = useState<PaginatedChunks | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChunks, setLoadingChunks] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [nextStats, nextDocuments] = await Promise.all([
        memoryApi.stats(),
        memoryApi.documents(),
      ]);
      setStats(nextStats);
      setDocuments(nextDocuments);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadChunks = useCallback(async (nextPage: number, nextQuery: string) => {
    setLoadingChunks(true);
    try {
      const data = await memoryApi.chunks({
        page: nextPage,
        limit: 10,
        query: nextQuery.trim() || undefined,
      });
      setChunks(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingChunks(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadChunks(page, query);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, loadChunks]);

  async function handleUpload(files: File[]) {
    setUploading(true);
    setError(null);
    setNotice(null);
    let success = 0;
    for (const file of files) {
      try {
        await memoryApi.upload(file);
        success += 1;
      } catch (err) {
        setError(`${file.name}: ${apiErrorMessage(err)}`);
      }
    }
    if (success) {
      setNotice(
        `${success} document${success === 1 ? "" : "s"} indexed. Entities are being extracted in the background.`
      );
      await loadOverview();
      setPage(1);
      await loadChunks(1, query);
    }
    setUploading(false);
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteContent.trim()) return;
    setNoteSaving(true);
    setError(null);
    setNotice(null);
    try {
      await memoryApi.quickNote({
        content: noteContent.trim(),
        tags: noteTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setNoteContent("");
      setNoteTags("");
      setNotice("Quick note saved and embedded into semantic memory.");
      await loadOverview();
      setPage(1);
      await loadChunks(1, query);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setNoteSaving(false);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    if (!window.confirm(`Delete "${document.filename}" and all its chunks?`)) return;
    try {
      await memoryApi.deleteDocument(document.id);
      setNotice(`Deleted ${document.filename}.`);
      await loadOverview();
      setPage(1);
      await loadChunks(1, query);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function deleteChunk(chunk: MemoryChunk) {
    if (!window.confirm("Delete this memory chunk?")) return;
    try {
      await memoryApi.deleteChunk(chunk.id);
      await loadOverview();
      await loadChunks(page, query);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Documents", value: stats?.documents ?? 0 },
          { label: "Chunks", value: stats?.chunks ?? 0 },
          { label: "Vectors", value: stats?.vectors ?? 0 },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            {loadingOverview ? (
              <Skeleton className="mt-2 h-7 w-14" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stat.value}
              </p>
            )}
          </Card>
        ))}
      </section>

      {error ? (
        <Alert variant="danger" className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" className="flex items-center justify-between gap-3">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vault className="h-4 w-4 text-slate-700 dark:text-white" /> Ingest knowledge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UploadDropzone onFiles={(files) => void handleUpload(files)} uploading={uploading} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-300" /> Quick note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={saveNote}>
              <div>
                <Label htmlFor="note">Thought, insight or journal entry</Label>
                <Textarea
                  id="note"
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder="What happened today? What did you learn?"
                  className="min-h-[104px] text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={noteTags}
                  onChange={(event) => setNoteTags(event.target.value)}
                  placeholder="career, reflection, idea"
                  className="text-xs"
                />
              </div>
              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={noteSaving || !noteContent.trim()}
              >
                {noteSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Save to memory
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" /> Documents
          </CardTitle>
          <Badge variant="muted">{documents.length} indexed</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingOverview ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : documents.length ? (
            documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    fileTone(document.file_type)
                  )}
                >
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-200">
                    {document.filename}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {document.file_type.toUpperCase()} · {formatBytes(document.file_size)} ·{" "}
                    {document.chunk_count} chunks · {formatDate(document.created_at)}
                  </p>
                </div>
                <Badge variant={document.source_type === "NOTE" ? "warning" : "muted"}>
                  {document.source_type}
                </Badge>
                <button
                  type="button"
                  onClick={() => void deleteDocument(document)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                  aria-label={`Delete ${document.filename}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No documents yet"
              description="Upload a resume, journal or project notes to build your memory."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-700 dark:text-white" /> Semantic chunks
            </CardTitle>
            <p className="mt-1 text-[11px] text-slate-500">
              {chunks?.total ?? 0} chunks embedded and searchable by your twin.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search chunk text..."
              className="h-9 pl-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingChunks ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : chunks && chunks.items.length ? (
            chunks.items.map((chunk) => {
              const entities = entityCount(chunk.extracted_entities);
              return (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-800 dark:text-slate-300">
                      {chunk.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => void deleteChunk(chunk)}
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                      aria-label="Delete chunk"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {chunk.tags
                      ? chunk.tags.split(",").map((tag) => (
                          <Badge key={tag} variant="muted" className="px-1.5 py-0 text-[9px]">
                            {tag}
                          </Badge>
                        ))
                      : null}
                    {entities ? (
                      <Badge variant="info" className="px-1.5 py-0 text-[9px]">
                        {entities} entities
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-400">
                      {relativeTime(chunk.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title={query ? "No matching chunks" : "No memory chunks yet"}
              description={
                query
                  ? "Try a broader search term."
                  : "Upload a document or save a quick note to populate semantic memory."
              }
            />
          )}

          {chunks && chunks.pages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-slate-500">
                Page {chunks.page} of {chunks.pages}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= chunks.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
