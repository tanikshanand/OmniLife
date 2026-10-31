"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiErrorMessage, authApi } from "@/lib/api";
import { isAuthenticated, saveSession } from "@/lib/auth";
import { useTwinStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useTwinStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  async function signIn(nextEmail: string, nextPassword: string) {
    if (loading) return;
    const cleanEmail = nextEmail.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!nextPassword) {
      setError("Please enter your password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login({
        email: cleanEmail,
        password: nextPassword,
      });
      saveSession(data.access_token, data.user);
      setUser(data.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to resume your conversation with the twin."
      footer={
        <p className="text-center text-xs text-slate-600 dark:text-neutral-400">
          New here?{" "}
          <Link href="/register" className="font-medium text-slate-900 dark:text-white hover:underline underline-offset-4">
            Create your twin
          </Link>
        </p>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(email, password);
        }}
      >
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="pl-10"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Your password"
              className="pl-10 pr-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        or
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <Button
        variant="subtle"
        className="w-full gap-2 border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-white dark:hover:bg-neutral-800"
        disabled={loading}
        onClick={() => void signIn("demo@omnilife.ai", "demo1234")}
      >
        <Sparkles className="h-4 w-4 text-amber-500 dark:text-white" />
        Explore the demo account
      </Button>
    </AuthShell>
  );
}
