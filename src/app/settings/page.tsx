"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/app";

const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-orange-500";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<{ blocked_id: string; profiles: Profile | Profile[] | null }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.replace("/login"); return; }
    setEmail(data.user.email ?? "");
    const [result, blocksResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.user.id).single(),
      supabase.from("blocked_users").select("blocked_id, profiles!blocked_users_blocked_id_fkey(*)").eq("blocker_id", data.user.id),
    ]);
    if (result.data) { setProfile(result.data as Profile); applyTheme((result.data as Profile).theme); }
    setBlockedUsers((blocksResult.data ?? []) as unknown as { blocked_id: string; profiles: Profile | Profile[] | null }[]);
  }, [router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setMessage("");
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName") ?? "").trim();
    let avatarUrl = profile.avatar_url;
    const avatar = data.get("avatar");
    if (avatar instanceof File && avatar.size > 0) {
      if (avatar.size > 2 * 1024 * 1024) { setMessage("Avatar must be 2 MB or smaller."); return; }
      const path = `${profile.id}/avatar`;
      const upload = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true });
      if (upload.error) { setMessage(upload.error.message); return; }
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("profiles").update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setMessage(error ? error.message : "Profile saved.");
    if (!error) await load();
  }

  async function changeTheme(event: ChangeEvent<HTMLSelectElement>) {
    if (!profile) return;
    const theme = event.target.value as Profile["theme"];
    setProfile({ ...profile, theme });
    applyTheme(theme);
    await supabase.from("profiles").update({ theme }).eq("id", profile.id);
  }

  async function updateInvitePreference(field: "allow_invites" | "auto_accept_invites", value: boolean) {
    if (!profile) return;
    const nextProfile = { ...profile, [field]: value };
    setProfile(nextProfile);
    const update: Partial<Profile> = { [field]: value };
    if (field === "allow_invites" && !value) {
      update.auto_accept_invites = false;
      setProfile({ ...nextProfile, auto_accept_invites: false });
    }
    await supabase.from("profiles").update(update).eq("id", profile.id);
  }

  async function unblock(userId: string) {
    if (!profile) return;
    await supabase.from("blocked_users").delete().eq("blocker_id", profile.id).eq("blocked_id", userId);
    await load();
  }

  async function deleteAccount() {
    if (deleteText !== "DELETE") return;
    if (!profile) return;
    const { data: ownedProjects } = await supabase.from("projects").select("id, image_path").eq("owner_id", profile.id);
    const ownedProjectIds = (ownedProjects ?? []).map((project: { id: string }) => project.id);
    const { data: ownedVideos } = ownedProjectIds.length
      ? await supabase.from("videos").select("thumbnail_path").in("project_id", ownedProjectIds)
      : { data: [] };
    const { data: createdVideos } = await supabase.from("videos").select("thumbnail_path").eq("created_by", profile.id);
    const mediaPaths = [
      ...(ownedProjects ?? []).map((project: { image_path: string | null }) => project.image_path),
      ...(ownedVideos ?? []).map((video: { thumbnail_path: string }) => video.thumbnail_path),
      ...(createdVideos ?? []).map((video: { thumbnail_path: string }) => video.thumbnail_path),
    ].filter((path): path is string => Boolean(path));
    if (mediaPaths.length) await supabase.storage.from("project-media").remove([...new Set(mediaPaths)]);
    await supabase.storage.from("avatars").remove([`${profile.id}/avatar`]);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) { setMessage(error.message); return; }
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Loading settings</main>;

  return (
    <main className="page-shell flex-1 text-[var(--foreground)]">
      <AppHeader profile={profile} email={email} />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link href="/projects" className="back-button"><span aria-hidden="true">‹</span> Projects</Link>
        <h1 className="mt-6 text-4xl font-bold">Account settings</h1>
        <p className="mt-3 text-[var(--muted)]">Manage how you appear and how StatTrack looks.</p>

        <form onSubmit={saveProfile} className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-xl font-bold">Profile</h2>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-orange-500 text-center text-3xl font-bold leading-[6rem] text-white">{profile.avatar_url ? <Image src={profile.avatar_url} alt="Profile picture" fill unoptimized className="object-cover" /> : profile.display_name.charAt(0)}</span>
            <div className="w-full space-y-4"><label className="block text-sm font-semibold">Display name<input name="displayName" required minLength={1} maxLength={80} defaultValue={profile.display_name} className={inputClass} /></label><label className="block text-sm font-semibold">Profile picture <span className="font-normal text-[var(--muted)]">(optional replacement)</span><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className={inputClass} /></label></div>
          </div>
          <label className="mt-5 block text-sm font-semibold">Google account email<input value={email} disabled className={`${inputClass} opacity-60`} /></label>
          <button className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Save profile</button>
          {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
        </form>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-xl font-bold">Appearance</h2><label className="mt-5 block text-sm font-semibold">Theme<select value={profile.theme} onChange={changeTheme} className={inputClass}><option value="system">Use system setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-xl font-bold">Invitations &amp; privacy</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Control who can invite you to a project.</p>
          <label className="mt-6 flex items-start justify-between gap-5 rounded-2xl border border-[var(--border)] p-4"><span><span className="block font-semibold">Allow project invitations</span><span className="mt-1 block text-sm text-[var(--muted)]">Owners can send invitations to your Google account email.</span></span><input type="checkbox" checked={profile.allow_invites} onChange={(event) => void updateInvitePreference("allow_invites", event.target.checked)} className="mt-1 h-5 w-5 accent-orange-500" /></label>
          <label className="mt-3 flex items-start justify-between gap-5 rounded-2xl border border-[var(--border)] p-4"><span><span className="block font-semibold">Automatically accept invitations</span><span className="mt-1 block text-sm text-[var(--muted)]">New projects appear immediately without asking you first.</span></span><input type="checkbox" disabled={!profile.allow_invites} checked={profile.auto_accept_invites} onChange={(event) => void updateInvitePreference("auto_accept_invites", event.target.checked)} className="mt-1 h-5 w-5 accent-orange-500 disabled:opacity-40" /></label>
          <div className="mt-7"><h3 className="font-semibold">Blocked accounts</h3>{blockedUsers.length ? <div className="mt-3 space-y-2">{blockedUsers.map((blocked) => { const person = Array.isArray(blocked.profiles) ? blocked.profiles[0] : blocked.profiles; return <div key={blocked.blocked_id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-3"><span className="truncate text-sm font-semibold">{person?.display_name ?? "Blocked user"}</span><button onClick={() => unblock(blocked.blocked_id)} className="text-sm text-orange-500">Unblock</button></div>; })}</div> : <p className="mt-2 text-sm text-[var(--muted)]">You have not blocked anyone.</p>}</div>
        </section>

        <section className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/[0.05] p-6">
          <h2 className="text-xl font-bold text-red-500">Delete account</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Permanently deletes your profile and data. Projects you own will also be deleted for every collaborator. This cannot be undone.</p><label className="mt-5 block text-sm font-semibold">Type DELETE to confirm<input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} className={inputClass} /></label><button type="button" disabled={deleteText !== "DELETE"} onClick={deleteAccount} className="mt-4 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-40">Permanently delete account</button>
        </section>
      </div>
    </main>
  );
}
