import axios from "axios";

import type {
  ApiError,
  AuthResponse,
  BenchmarkRole,
  ChatSession,
  ChatSessionDetail,
  DailyLog,
  DocumentItem,
  GapAnalysis,
  Goal,
  GraphData,
  GraphNode,
  GraphNodeDetails,
  KanbanBoard,
  MemoryChunk,
  MemoryStats,
  Metrics,
  PaginatedChunks,
  Profile,
  RoadmapResponse,
  SourceCitation,
  Task,
  TaskStatus,
  TwinMode,
  User,
  WeeklyDebrief,
} from "@/types";
import { clearSession, getToken } from "./auth";

function resolveApiBaseUrl(): string {
  // 1. Explicit override from environment variable (e.g. production domain)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }
  // 2. In browser environments: use relative path "/api/v1" by default.
  // Next.js rewrites /api/v1/:path* to backend (http://127.0.0.1:8000/api/v1/:path*).
  // This automatically works across localhost, LAN IPv4 (192.168.x.x), and mobile devices without CORS or port blocks.
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  // 3. In SSR / Node runtime environments:
  return process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      clearSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      return "Unable to connect to the server. Please check your network connection.";
    }
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return "The request took too long. Check your connection and retry.";
    }

    const status = error.response?.status;
    const data = error.response?.data as ApiError | undefined;
    const detail = data?.detail;

    if (status === 401) {
      return detail || "Incorrect email or password.";
    }
    if (status === 403) {
      return detail || "You do not have permission to perform this action.";
    }
    if (status === 404) {
      return detail || "The requested resource was not found.";
    }
    if (status === 409) {
      return detail || "A conflict occurred with an existing resource.";
    }
    if (status === 422) {
      return detail || "Please verify your input fields.";
    }
    if (status === 429) {
      return "Too many requests. Please wait a moment and retry.";
    }
    if (status && status >= 500) {
      return "Server is currently unavailable. Please try again shortly.";
    }

    return detail || error.message || "Request failed. Please try again.";
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Request was cancelled.";
    }
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Load failed")
    ) {
      return "Unable to connect to the server. Please check your network connection.";
    }
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export const authApi = {
  register: (payload: { email: string; password: string; full_name: string }) =>
    api.post<AuthResponse>("/auth/register", payload).then((r) => r.data),
  login: (payload: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", payload).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  getProfile: () => api.get<Profile>("/profile").then((r) => r.data),
  updateProfile: (payload: Partial<Profile>) =>
    api.put<Profile>("/profile", payload).then((r) => r.data),
  exportData: () => api.get<Record<string, unknown>>("/profile/export").then((r) => r.data),
  invite: (payload: { email: string; password: string; full_name: string }) =>
    api.post<{ status: string; message: string; user: User }>("/auth/invite", payload).then((r) => r.data),
  members: () =>
    api.get<Array<{ id: string; email: string; full_name: string; is_current: boolean; created_at: string }>>("/auth/members").then((r) => r.data),
  switchAccount: (payload: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/switch-account", payload).then((r) => r.data),
};

export const memoryApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<DocumentItem>("/memory/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  quickNote: (payload: { content: string; tags: string[] }) =>
    api.post<MemoryChunk>("/memory/quick-note", payload).then((r) => r.data),
  chunks: (params: { query?: string; page?: number; limit?: number } = {}) =>
    api.get<PaginatedChunks>("/memory/chunks", { params }).then((r) => r.data),
  documents: () => api.get<DocumentItem[]>("/memory/documents").then((r) => r.data),
  stats: () => api.get<MemoryStats>("/memory/stats").then((r) => r.data),
  deleteDocument: (id: string) => api.delete(`/memory/documents/${id}`),
  deleteChunk: (id: string) => api.delete(`/memory/chunks/${id}`),
};

export const graphApi = {
  subgraph: (params: { depth?: number; limit?: number } = {}) =>
    api.get<GraphData>("/graph/subgraph", { params }).then((r) => r.data),
  node: (id: string) =>
    api.get<GraphNodeDetails>(`/graph/nodes/${id}`).then((r) => r.data),
  createNode: (payload: {
    label: string;
    name: string;
    properties?: Record<string, unknown>;
  }) => api.post<GraphNode>("/graph/nodes", payload).then((r) => r.data),
  updateNode: (id: string, properties: Record<string, unknown>) =>
    api.patch<GraphNode>(`/graph/nodes/${id}`, properties).then((r) => r.data),
  createRelationship: (payload: {
    source_id: string;
    target_id: string;
    label: string;
    properties?: Record<string, unknown>;
  }) => api.post("/graph/relationships", payload).then((r) => r.data),
  deleteRelationship: (source_id: string, target_id: string, label?: string) =>
    api.delete("/graph/relationships", { params: { source_id, target_id, label } }).then((r) => r.data),
  deleteRelationshipByNames: (source_name: string, target_name: string) =>
    api.delete("/graph/relationships/by-names", { params: { source_name, target_name } }).then((r) => r.data),
  deleteNode: (id: string) => api.delete(`/graph/nodes/${id}`),
};

export interface ChatActionItem {
  type: string;
  name: string;
  details: string;
}

export interface ChatStreamHandlers {
  onContext?: (data: {
    sources: SourceCitation[];
    session_id: string;
    mode: TwinMode;
    actions?: ChatActionItem[];
  }) => void;
  onMessage?: (delta: string) => void;
  onDone?: (data: { session_id: string; message_id?: string | null }) => void;
  onError?: (error: Error) => void;
}

function dispatchSseEvent(rawEvent: string, handlers: ChatStreamHandlers) {
  let event = "message";
  let data = "";
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    if (event === "context") handlers.onContext?.(parsed);
    else if (event === "message") handlers.onMessage?.(parsed.delta || "");
    else if (event === "done") handlers.onDone?.(parsed);
  } catch {
    // ignore malformed keep-alive chunks
  }
}

export async function streamChat(
  payload: { session_id?: string; query: string; mode: TwinMode },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let detail = `Chat request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (!response.body) throw new Error("Streaming is not supported by this browser");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const rawEvent of events) {
      dispatchSseEvent(rawEvent, handlers);
    }
  }
  if (buffer.trim()) dispatchSseEvent(buffer, handlers);
}

export const chatApi = {
  sessions: () => api.get<ChatSession[]>("/chat/sessions").then((r) => r.data),
  createSession: (payload: { title?: string; mode?: TwinMode } = {}) =>
    api.post<ChatSession>("/chat/sessions", payload).then((r) => r.data),
  getSession: (id: string) =>
    api.get<ChatSessionDetail>(`/chat/sessions/${id}`).then((r) => r.data),
  getPrimarySession: () =>
    api.get<ChatSessionDetail>("/chat/sessions/primary").then((r) => r.data),
  resetPrimarySession: () =>
    api.post<ChatSessionDetail>("/chat/sessions/reset").then((r) => r.data),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`),
};

export const goalsApi = {
  list: () => api.get<Goal[]>("/goals").then((r) => r.data),
  get: (id: string) => api.get<Goal>(`/goals/${id}`).then((r) => r.data),
  create: (payload: {
    title: string;
    description?: string;
    category?: string;
    target_date?: string;
  }) => api.post<Goal>("/goals", payload).then((r) => r.data),
  update: (id: string, payload: Partial<Goal>) =>
    api.patch<Goal>(`/goals/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/goals/${id}`),
  decompose: (id: string) =>
    api.post<Goal>(`/goals/${id}/decompose`).then((r) => r.data),
  kanban: () => api.get<KanbanBoard>("/tasks/kanban").then((r) => r.data),
  createTask: (payload: {
    title: string;
    description?: string;
    milestone_id?: string;
    priority?: string;
    estimated_hours?: string;
    skill_tags?: string;
  }) => api.post<Task>("/tasks", payload).then((r) => r.data),
  updateTask: (id: string, payload: Partial<Task>) =>
    api.patch<Task>(`/tasks/${id}`, payload).then((r) => r.data),
  updateTaskStatus: (id: string, status: TaskStatus) =>
    api.patch<Task>(`/tasks/${id}/status`, { status }).then((r) => r.data),
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),
};

export const careerApi = {
  roles: () => api.get<BenchmarkRole[]>("/career/benchmark-roles").then((r) => r.data),
  gap: (roleId: string) =>
    api
      .get<GapAnalysis>("/career/gap-analysis", { params: { role_id: roleId } })
      .then((r) => r.data),
  roadmap: (roleId: string, weeks = 4) =>
    api
      .post<RoadmapResponse>("/career/generate-roadmap", {
        role_id: roleId,
        weeks,
      })
      .then((r) => r.data),
};

export const analyticsApi = {
  dailyLog: (payload: {
    log_date?: string;
    energy_level: number;
    accomplishments?: string;
    blockers?: string;
    tomorrow_priorities?: string;
  }) => api.post<DailyLog>("/analytics/daily-log", payload).then((r) => r.data),
  logs: (limit = 30) =>
    api
      .get<DailyLog[]>("/analytics/daily-logs", { params: { limit } })
      .then((r) => r.data),
  metrics: (days = 30) =>
    api
      .get<Metrics>("/analytics/metrics", { params: { days } })
      .then((r) => r.data),
  debrief: () =>
    api.get<WeeklyDebrief>("/analytics/weekly-debrief").then((r) => r.data),
};

export const voiceApi = {
  tts: (text: string, voice = "en-US-ChristopherNeural") =>
    api
      .post<Blob>(
        "/voice/tts",
        { text, voice },
        { responseType: "blob" }
      )
      .then((r) => r.data),
  transcribe: (audio: Blob) => {
    const form = new FormData();
    form.append("audio", audio, "audio.webm");
    return api
      .post<{ text: string; available: boolean }>("/voice/transcribe", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
