"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, LogOut, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { apiErrorMessage, authApi } from "@/lib/api";
import { clearSession, saveSession } from "@/lib/auth";
import { useTwinStore } from "@/lib/store";
import { initials } from "@/lib/utils";

interface Member {
  id: string;
  email: string;
  full_name: string;
  is_current: boolean;
  created_at: string | null;
}

export function UserSwitcherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const currentUser = useTwinStore((state) => state.user);
  const setUser = useTwinStore((state) => state.setUser);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Switch account state
  const [switchingTo, setSwitchingTo] = useState<Member | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);

  // Add person state
  const [addingPerson, setAddingPerson] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSwitchingTo(null);
      setSwitchPassword("");
      setAddingPerson(false);
      setError(null);
      setNotice(null);
      return;
    }

    void loadMembers();
  }, [open]);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const list = await authApi.members();
      setMembers(list);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitch(event: React.FormEvent) {
    event.preventDefault();
    if (!switchingTo || !switchPassword) return;
    setSwitchLoading(true);
    setError(null);
    try {
      const resp = await authApi.switchAccount({
        email: switchingTo.email,
        password: switchPassword,
      });
      saveSession(resp.access_token, resp.user);
      setUser(resp.user);
      onOpenChange(false);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSwitchLoading(false);
    }
  }

  async function handleAddPerson(event: React.FormEvent) {
    event.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPassword) return;
    setAddLoading(true);
    setError(null);
    try {
      const resp = await authApi.invite({
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
      });
      setNotice(resp.message);
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setAddingPerson(false);
      await loadMembers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAddLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    onOpenChange(false);
    router.replace("/login");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="People & Profiles"
      description="OmniLife guarantees complete data isolation between accounts."
      className="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        {switchingTo ? (
          <form onSubmit={handleSwitch} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-black">
                {initials(switchingTo.full_name || switchingTo.email)}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Switch to {switchingTo.full_name}
                </p>
                <p className="text-[10px] text-slate-500">{switchingTo.email}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="switch-pass">Account Password</Label>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="switch-pass"
                  type="password"
                  required
                  placeholder="Enter password to verify identity"
                  className="pl-9 text-xs"
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSwitchingTo(null)}
              >
                Back
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={switchLoading || !switchPassword}
              >
                {switchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Verify & Switch
              </Button>
            </div>
          </form>
        ) : addingPerson ? (
          <form onSubmit={handleAddPerson} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Add Person to OmniLife
            </p>
            <div>
              <Label htmlFor="add-name">Full name</Label>
              <Input
                id="add-name"
                required
                placeholder="Ada Lovelace"
                className="text-xs"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                required
                placeholder="ada@example.com"
                className="text-xs"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="text-xs"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAddingPerson(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={addLoading || !newFullName || !newEmail || !newPassword}
              >
                {addLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Create Account
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {loading ? (
                <div className="py-6 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : members.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 transition ${
                    member.is_current
                      ? "border-emerald-500/40 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {initials(member.full_name || member.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {member.full_name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {member.is_current ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setSwitchingTo(member)}
                    >
                      Switch
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setAddingPerson(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add person
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-slate-400">
          <p className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Strict Data Isolation Guarantee
          </p>
          <p className="mt-1">
            Each person has their own isolated knowledge graph, memories, and chat threads.
            Two accounts can use the exact same project or skill names without seeing or modifying each other&apos;s private data.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
