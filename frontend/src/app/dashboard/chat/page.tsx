"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Compass,
  Lightbulb,
  ListChecks,
  PanelLeft,
  RotateCcw,
} from "lucide-react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { SessionList } from "@/components/chat/session-list";
import { useSpeech } from "@/components/voice/use-speech";
import { VoiceStatusBar } from "@/components/voice/voice-status-bar";
import { Alert, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  apiErrorMessage,
  chatApi,
  streamChat,
} from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import type { ChatMessage, ChatSession, TwinMode } from "@/types";
import { cn } from "@/lib/utils";

const suggestions = [
  {
    icon: Lightbulb,
    title: "What should I focus on?",
    prompt:
      "Based on my goals, recent tasks and memory, what should I focus on this week?",
  },
  {
    icon: Compass,
    title: "Assess my readiness",
    prompt:
      "What are my strongest skills right now, and which gaps matter most for an AI Systems Engineer role?",
  },
  {
    icon: ListChecks,
    title: "Plan my next milestone",
    prompt:
      "Give me a concrete plan for the next milestone of my most important goal.",
  },
];

function nowIso() {
  return new Date().toISOString();
}

export default function ChatPage() {
  const activeMode = useTwinStore((state) => state.activeMode);
  const setActiveMode = useTwinStore((state) => state.setActiveMode);

  const {
    speak,
    stopSpeaking,
    speaking,
    listening,
    startListening,
    stopListening,
    sttSupported,
  } = useSpeech();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ type: string; name: string; details: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const speechBaseRef = useRef("");
  const initializedRef = useRef(false);
  const userScrolledUpRef = useRef(false);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    userScrolledUpRef.current = !isNearBottom;
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await chatApi.sessions();
    setSessions(list);
    return list;
  }, []);

  const selectSession = useCallback(
    async (session: ChatSession) => {
      abortRef.current?.abort();
      setSessionId(session.id);
      setSessionsOpen(false);
      setError(null);
      setLastAction(null);
      setLoadingMessages(true);
      try {
        const detail = await chatApi.getSession(session.id);
        setMessages(detail.messages);
        setActiveMode(detail.active_mode);
        window.history.replaceState(
          null,
          "",
          `/dashboard/chat?session=${session.id}`
        );
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoadingMessages(false);
      }
    },
    [setActiveMode]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      setLoadingSessions(true);
      try {
        const requested =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("session")
            : null;
        if (requested) {
          const detail = await chatApi.getSession(requested);
          setSessionId(detail.id);
          setMessages(detail.messages);
          setActiveMode(detail.active_mode);
        } else {
          // Default directly to the user's single persistent main conversation
          const primary = await chatApi.getPrimarySession();
          setSessionId(primary.id);
          setMessages(primary.messages);
          setActiveMode(primary.active_mode);
        }
        const list = await chatApi.sessions();
        setSessions(list);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [setActiveMode]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!userScrolledUpRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, loadingMessages]);

  async function resetMainChat() {
    if (messages.length > 0 && !window.confirm("Start fresh and clear this conversation? Your knowledge graph and memories remain intact.")) {
      return;
    }
    abortRef.current?.abort();
    setLoadingMessages(true);
    try {
      const primary = await chatApi.resetPrimarySession();
      setSessionId(primary.id);
      setMessages(primary.messages);
      setActiveMode(primary.active_mode);
      setInput("");
      setError(null);
      setLastAction(null);
      await refreshSessions();
      window.history.replaceState(null, "", "/dashboard/chat");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingMessages(false);
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    setSessionId(null);
    setMessages([]);
    setError(null);
    setLastAction(null);
    setInput("");
    setSessionsOpen(false);
    window.history.replaceState(null, "", "/dashboard/chat");
  }

  async function deleteSession(session: ChatSession) {
    if (!window.confirm(`Delete "${session.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await chatApi.deleteSession(session.id);
      if (sessionId === session.id) startNewChat();
      await refreshSessions();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function sendMessage(textOverride?: string) {
    const query = (textOverride ?? input).trim();
    if (!query || streaming) return;

    setInput("");
    setError(null);
    userScrolledUpRef.current = false;

    const timestamp = nowIso();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      session_id: sessionId || "",
      role: "user",
      content: query,
      sources_cited: [],
      created_at: timestamp,
    };
    const assistantId = `assistant-${Date.now()}`;
    streamingIdRef.current = assistantId;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      session_id: sessionId || "",
      role: "assistant",
      content: "",
      sources_cited: [],
      created_at: timestamp,
    };
    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let newSessionId = sessionId;

    try {
      await streamChat(
        {
          session_id: sessionId || undefined,
          query,
          mode: activeMode,
        },
        {
          onContext: (data) => {
            newSessionId = data.session_id;
            setSessionId(data.session_id);
            if (data.actions && data.actions.length > 0) {
              setLastAction(data.actions[0]);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("omnilife:graph_updated"));
              }
            }
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      session_id: data.session_id,
                      sources_cited: data.sources || [],
                    }
                  : message
              )
            );
          },
          onMessage: (delta) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message
              )
            );
          },
          onDone: (data) => {
            newSessionId = data.session_id;
            setSessionId(data.session_id);
            window.history.replaceState(
              null,
              "",
              `/dashboard/chat?session=${data.session_id}`
            );
            void refreshSessions().catch(() => undefined);
          },
        },
        controller.signal
      );
      if (newSessionId && newSessionId !== sessionId) {
        void refreshSessions().catch(() => undefined);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        const message = apiErrorMessage(err);
        setError(message);
        setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId && !item.content
              ? {
                  ...item,
                  content: `I could not complete that request. ${message}`,
                }
              : item
          )
        );
      }
    } finally {
      setStreaming(false);
      streamingIdRef.current = null;
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    const streamingId = streamingIdRef.current;
    if (streamingId) {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === streamingId && !message.content
            ? { ...message, content: "Stopped." }
            : message
        )
      );
    }
    setStreaming(false);
  }

  function toggleMic() {
    if (listening) {
      stopListening();
      return;
    }
    speechBaseRef.current = input.trim();
    const started = startListening((text) => {
      setInput(
        speechBaseRef.current ? `${speechBaseRef.current} ${text}` : text
      );
    });
    if (!started) {
      setError("Speech recognition is not available in this browser.");
    }
  }

  const activeSession = sessions.find((session) => session.id === sessionId);

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-8.5rem)] min-h-[440px] sm:min-h-[560px] gap-3 sm:gap-4">
      <aside className="hidden w-72 shrink-0 flex-col overflow-hidden glass-card lg:flex">
        <SessionList
          sessions={sessions}
          activeId={sessionId}
          loading={loadingSessions}
          onSelect={(session) => void selectSession(session)}
          onNew={startNewChat}
          onDelete={(session) => void deleteSession(session)}
        />
      </aside>

      <Sheet
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        title="Conversations"
        description="Resume a thread or start fresh."
        className="p-0"
      >
        <div className="h-[calc(100dvh-5rem)]">
          <SessionList
            sessions={sessions}
            activeId={sessionId}
            loading={loadingSessions}
            onSelect={(session) => void selectSession(session)}
            onNew={startNewChat}
            onDelete={(session) => void deleteSession(session)}
          />
        </div>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden glass-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800/70 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden shrink-0"
              onClick={() => setSessionsOpen(true)}
              aria-label="Open conversations"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">
                {activeSession?.title || "New conversation"}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {activeMode === "MENTOR"
                  ? "Mentor · strategic & direct"
                  : "Clone · speaks as you"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950/60">
              {(["MENTOR", "CLONE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveMode(mode)}
                  disabled={streaming}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-medium transition sm:px-3",
                    activeMode === mode
                      ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/60 dark:bg-white dark:text-black dark:border-transparent"
                      : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                  )}
                >
                  {mode === "MENTOR" ? "Mentor" : "Clone"}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2.5 text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              onClick={() => void resetMainChat()}
              title="Reset conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>

            <Badge variant="success" className="hidden gap-1 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              GraphRAG
            </Badge>
          </div>
        </header>

        {lastAction ? (
          <div className="px-3 pt-3 sm:px-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-900 dark:text-emerald-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  <strong>Knowledge Graph Updated:</strong> {lastAction.details}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setLastAction(null)}
                className="text-xs hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="px-3 pt-3 sm:px-4">
            <Alert variant="danger" className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1">{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </Alert>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 space-y-5 overflow-y-auto px-3 py-5 scrollbar-thin sm:px-5"
        >
          {loadingMessages ? (
            <div className="space-y-4">
              <Skeleton className="ml-auto h-16 w-2/3" />
              <Skeleton className="h-28 w-4/5" />
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                mode={activeMode}
                streaming={streaming && message.id === streamingIdRef.current}
                speaking={speaking && speakingMessageId === message.id}
                onSpeak={(text) => {
                  setSpeakingMessageId(message.id);
                  void speak(text);
                }}
                onStopSpeaking={() => {
                  stopSpeaking();
                  setSpeakingMessageId(null);
                }}
              />
            ))
          ) : (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-800 dark:border-white/20 dark:bg-white/10 dark:text-white">
                <BrainCircuit className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                Your twin is listening
              </h2>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
                Ask about your goals, skills, documents or week. Answers are
                grounded in your semantic memory and knowledge graph.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => void sendMessage(suggestion.prompt)}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-800 dark:bg-[#0a0a0a] dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                  >
                    <suggestion.icon className="h-4 w-4 text-slate-700 dark:text-white" />
                    <p className="mt-2 text-[11px] font-medium text-slate-800 dark:text-neutral-200">
                      {suggestion.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <VoiceStatusBar
          listening={listening}
          speaking={speaking}
          onStop={() => {
            stopListening();
            stopSpeaking();
            setSpeakingMessageId(null);
          }}
        />

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => void sendMessage()}
          onStop={stopStreaming}
          streaming={streaming}
          listening={listening}
          sttSupported={sttSupported}
          onToggleMic={toggleMic}
          disabled={loadingMessages}
        />
      </section>
    </div>
  );
}
