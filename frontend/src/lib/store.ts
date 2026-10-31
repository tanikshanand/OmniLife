import { create } from "zustand";

import type { GraphNode, TwinMode, User } from "@/types";

export type Theme = "dark" | "light";

interface TwinState {
  user: User | null;
  setUser: (user: User | null) => void;
  activeMode: TwinMode;
  setActiveMode: (mode: TwinMode) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  selectedGraphNode: GraphNode | null;
  setSelectedGraphNode: (node: GraphNode | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  presentationMode: boolean;
  setPresentationMode: (active: boolean) => void;
  togglePresentationMode: () => void;
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("omnilife-theme", theme);
    } catch {}
  }
}

const initialTheme: Theme =
  typeof window !== "undefined" && localStorage.getItem("omnilife-theme") === "light"
    ? "light"
    : "dark";

export const useTwinStore = create<TwinState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeMode: "MENTOR",
  setActiveMode: (mode) => set({ activeMode: mode }),
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    set({ theme: nextTheme });
  },
  isVoiceActive: false,
  setIsVoiceActive: (active) => set({ isVoiceActive: active }),
  selectedGraphNode: null,
  setSelectedGraphNode: (node) => set({ selectedGraphNode: node }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  presentationMode: false,
  setPresentationMode: (active) => set({ presentationMode: active }),
  togglePresentationMode: () => set((state) => ({ presentationMode: !state.presentationMode })),
}));
