"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime";
import type { Profile } from "@/types/app";

type Invitation = {
  id: string;
  invited_by: string;
  projects: { name: string; color: string } | { name: string; color: string }[] | null;
  profiles: Profile | Profile[] | null;
};

export default function InvitationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    setEmail(auth.user.email ?? "");
    const [profileResult, inviteResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase.from("project_invites").select("id, invited_by, projects(name, color), profiles!project_invites_invited_by_fkey(*)").or(`recipient_id.eq.${auth.user.id},email.eq.${auth.user.email ?? ""}`).order("created_at", { ascending: false }),
    ]);
    if (profileResult.data) { setProfile(profileResult.data as Profile); applyTheme((profileResult.data as Profile).theme); }
    setInvitations((inviteResult.data ?? []) as unknown as Invitation[]);
  }, [router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authenticateRealtime(supabase).then((authenticated) => {
      if (cancelled || !authenticated) return;
      channel = supabase.channel("invitation-inbox", { config: { private: true } }).on("postgres_changes", { event: "*", schema: "public", table: "project_invites" }, () => void load()).subscribe();
    });
    return () => { cancelled = true; window.clearTimeout(initialLoad); if (channel) void supabase.removeChannel(channel); };
  }, [load, supabase]);

  async function accept(id: string) {
    setMessage("");
    const { data, error } = await supabase.rpc("accept_project_invite", { invite_id: id });
    if (error) { setMessage(error.message); return; }
    router.push(`/projects/${data}`);
  }

  async function decline(id: string) {
    const { error } = await supabase.rpc("decline_project_invite", { invite_id: id });
    if (error) setMessage(error.message); else await load();
  }

  async function block(id: string) {
    if (!window.confirm("Block this account? They will not be able to invite you again unless you unblock them in Account settings.")) return;
    const { error } = await supabase.rpc("block_inviter", { invite_id: id });
    if (error) setMessage(error.message); else await load();
  }

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Loading invitations</main>;

  return (
    <main className="page-shell flex-1 text-[var(--foreground)]">
      <AppHeader profile={profile} email={email} />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link href="/projects" className="back-button mb-8"><span aria-hidden="true">‹</span> Projects</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">Collaboration</p>
        <h1 className="mt-2 text-4xl font-bold">Invitations</h1>
        <p className="mt-3 text-[var(--muted)]">Review project invitations sent to your account.</p>
        {message && <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{message}</p>}
        <section className="mt-8 space-y-4">
          {invitations.map((invitation) => {
            const sender = Array.isArray(invitation.profiles) ? invitation.profiles[0] : invitation.profiles;
            const project = Array.isArray(invitation.projects) ? invitation.projects[0] : invitation.projects;
            return <article key={invitation.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-center gap-4"><span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: project?.color ?? "#f97316" }}>{sender?.avatar_url ? <Image src={sender.avatar_url} alt="" fill unoptimized className="object-cover" /> : sender?.display_name?.charAt(0)}</span><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{project?.name ?? "Project invitation"}</h2><p className="mt-1 text-sm text-[var(--muted)]">From {sender?.display_name ?? "a StatTrack user"}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => accept(invitation.id)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white">Accept</button><button onClick={() => decline(invitation.id)} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">Decline</button><button onClick={() => block(invitation.id)} className="ml-auto rounded-xl px-4 py-2.5 text-sm text-red-500">Block sender</button></div></article>;
          })}
          {!invitations.length && <div className="rounded-3xl border-2 border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">You have no pending invitations.</div>}
        </section>
      </div>
    </main>
  );
}
