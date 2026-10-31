"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getStoredUser, isAuthenticated } from "@/lib/auth";
import { useTwinStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useTwinStore((state) => state.setUser);
  const presentationMode = useTwinStore((state) => state.presentationMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setReady(true);
  }, [router, setUser]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-900 dark:text-white" />
      </div>
    );
  }

  const isGraphPage = pathname === "/dashboard/graph";

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white transition-colors">
      <Sidebar />
      <div
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden transition-all duration-300",
          presentationMode && isGraphPage
            ? "lg:pl-0"
            : isGraphPage
            ? "lg:pl-14"
            : "lg:pl-64"
        )}
      >
        {!isGraphPage && <Topbar />}
        <main
          className={
            isGraphPage
              ? "flex-1 w-full h-full min-h-0 min-w-0 flex flex-col p-0 overflow-hidden"
              : "mx-auto w-full max-w-7xl flex-1 min-h-0 px-3.5 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8 overflow-y-auto"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
