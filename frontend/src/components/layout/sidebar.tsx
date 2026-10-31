"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  Compass,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Network,
  Sun,
  Target,
  Users,
  Vault,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserSwitcherDialog } from "@/components/layout/user-switcher-dialog";
import { clearSession } from "@/lib/auth";
import { useTwinStore } from "@/lib/store";
import { cn, initials } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "Twin Chat", icon: MessageSquare },
  { href: "/dashboard/graph", label: "Knowledge Graph", icon: Network },
  { href: "/dashboard/memory", label: "Memory Vault", icon: Vault },
  { href: "/dashboard/goals", label: "Goals & Kanban", icon: Target },
  { href: "/dashboard/career", label: "Career Compass", icon: Compass },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useTwinStore((state) => state.user);
  const setUser = useTwinStore((state) => state.setUser);
  const activeMode = useTwinStore((state) => state.activeMode);
  const setActiveMode = useTwinStore((state) => state.setActiveMode);
  const theme = useTwinStore((state) => state.theme);
  const setTheme = useTwinStore((state) => state.setTheme);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  function handleLogout() {
    clearSession();
    setUser(null);
    router.replace("/login");
  }

  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs dark:border-white/20 dark:bg-white/10 dark:text-white">
          <BrainCircuit className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            OmniLife
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Digital twin
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition font-medium",
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-xs dark:bg-white/10 dark:text-white dark:border dark:border-white/15"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-slate-900 dark:text-white" : "text-slate-500"
                )}
              />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-6">
          <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Active twin mode
          </p>
          <div className="mx-1 mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-neutral-800 dark:bg-black/60">
            {(["MENTOR", "CLONE"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveMode(mode)}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                  activeMode === mode
                    ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/60 dark:bg-white dark:text-black dark:border-transparent"
                    : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                )}
              >
                {mode === "MENTOR" ? "Mentor" : "Clone"}
              </button>
            ))}
          </div>
          <p className="mt-2 px-3 text-[10px] leading-relaxed text-slate-500">
            {activeMode === "MENTOR"
              ? "Strategic, challenging, growth-oriented."
              : "Speaks as you, using your indexed voice."}
          </p>
        </div>

        <div className="pt-5">
          <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Appearance
          </p>
          <div className="mx-1 mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-neutral-800 dark:bg-black/60">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                theme === "dark"
                  ? "bg-slate-900 text-white shadow-xs font-semibold dark:bg-white dark:text-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                theme === "light"
                  ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80 dark:bg-neutral-800 dark:text-white dark:border-transparent"
                  : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-neutral-800">
        <div
          onClick={() => setSwitcherOpen(true)}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-neutral-900 cursor-pointer"
          title="Switch profile or add member"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
            {initials(user?.profile?.full_name || user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-neutral-200">
              {user?.profile?.full_name || user?.email || "OmniLife user"}
            </p>
            <p className="truncate text-[10px] text-slate-500">Switch account</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-slate-200 dark:hover:text-rose-400 dark:hover:bg-neutral-800"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UserSwitcherDialog
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
      />
    </>
  );
}

function SidebarRail() {
  const pathname = usePathname();
  const theme = useTwinStore((state) => state.theme);
  const setTheme = useTwinStore((state) => state.setTheme);
  const user = useTwinStore((state) => state.user);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="flex h-full w-14 flex-col items-center justify-between border-r border-slate-200 dark:border-neutral-800/80 bg-white dark:bg-[#0a0a0a] py-3 transition-colors">
      {/* Top Logo */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-cyan-500/10 dark:border dark:border-cyan-500/20 dark:text-cyan-400 hover:opacity-90 transition shadow-xs"
          title="OmniLife Digital Twin"
        >
          <BrainCircuit className="h-5 w-5" />
        </Link>

        {/* Navigation icons */}
        <nav className="flex flex-col items-center gap-1.5 pt-2">
          {navigation.map((item) => {
            const isActive = item.href === pathname;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-xl transition",
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-xs dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30 dark:shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {isActive && (
                  <span className="absolute -left-1.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-slate-900 dark:bg-cyan-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom controls: Theme & User Avatar */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-white transition"
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5 text-amber-300" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-slate-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-800 hover:border-slate-300 dark:bg-cyan-950/80 dark:border-cyan-500/30 dark:text-cyan-300 dark:hover:border-cyan-400 transition"
          title={user?.profile?.full_name || user?.email || "Profile"}
        >
          {initials(user?.profile?.full_name || user?.email || "TA")}
        </button>
      </div>

      <UserSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useTwinStore((state) => state.sidebarOpen);
  const setSidebarOpen = useTwinStore((state) => state.setSidebarOpen);
  const presentationMode = useTwinStore((state) => state.presentationMode);
  const pathname = usePathname();
  const isGraphPage = pathname === "/dashboard/graph";

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex-col border-r border-slate-200 bg-white dark:border-slate-800/70 dark:bg-slate-950/90 transition-all duration-300",
          presentationMode && isGraphPage
            ? "hidden"
            : isGraphPage
            ? "hidden lg:flex w-14"
            : "hidden lg:flex w-64"
        )}
      >
        {isGraphPage ? <SidebarRail /> : <SidebarContent />}
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/80 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fade-in flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3.5 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200 transition-colors"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
