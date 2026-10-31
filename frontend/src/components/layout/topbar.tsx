"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageSquare, Mic, Moon, Sun, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserSwitcherDialog } from "@/components/layout/user-switcher-dialog";
import { useTwinStore } from "@/lib/store";
import { initials } from "@/lib/utils";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Overview",
    subtitle: "Your twin's current state of mind",
  },
  "/dashboard/chat": {
    title: "Twin Chat",
    subtitle: "Mentor and clone conversations grounded in your memory",
  },
  "/dashboard/graph": {
    title: "Knowledge Graph",
    subtitle: "Every skill, project and person you have indexed",
  },
  "/dashboard/memory": {
    title: "Memory Vault",
    subtitle: "Documents, notes and semantic chunks",
  },
  "/dashboard/goals": {
    title: "Goals & Kanban",
    subtitle: "Decompose ambitions into shipped work",
  },
  "/dashboard/career": {
    title: "Career Compass",
    subtitle: "Readiness, skill gaps and learning sprints",
  },
  "/dashboard/analytics": {
    title: "Analytics",
    subtitle: "Momentum, energy and focus over time",
  },
};

export function Topbar() {
  const pathname = usePathname();
  const setSidebarOpen = useTwinStore((state) => state.setSidebarOpen);
  const user = useTwinStore((state) => state.user);
  const activeMode = useTwinStore((state) => state.activeMode);
  const theme = useTwinStore((state) => state.theme);
  const toggleTheme = useTwinStore((state) => state.toggleTheme);
  const meta = titles[pathname] || titles["/dashboard"];
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 dark:border-neutral-800/80 dark:bg-black/90 backdrop-blur-md transition-colors">
      <div className="flex h-16 items-center gap-2.5 px-3.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white sm:text-base">
            {meta.title}
          </h1>
          <p className="hidden truncate text-[11px] text-slate-500 sm:block">
            {meta.subtitle}
          </p>
        </div>

        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Twin online · {activeMode === "MENTOR" ? "Mentor" : "Clone"}
        </span>

        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0 border-slate-200 dark:border-neutral-800"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-300" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 px-2.5 text-xs font-medium"
          onClick={() => setSwitcherOpen(true)}
          title="Switch profile or add person"
        >
          <Users className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden md:inline">Accounts</span>
        </Button>

        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800 transition hover:border-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-400 cursor-pointer"
          title={`Active account: ${user?.profile?.full_name || user?.email} (Click to switch)`}
        >
          {initials(user?.profile?.full_name || user?.email)}
        </button>

        <UserSwitcherDialog
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      </div>
    </header>
  );
}
