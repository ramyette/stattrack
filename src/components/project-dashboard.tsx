"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime";
import type { Profile, Project, Video } from "@/types/app";

type DisplayVideo = Video & { thumbnailUrl?: string };
type Member = { user_id: string; role: "owner" | "editor"; profiles: Profile | Profile[] | null };
type PendingInvite = { id: string; email: string };
const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none focus:border-orange-500";
const numberFormatter = new Intl.NumberFormat("en-US");

export default function ProjectDashboard({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [projectLogo, setProjectLogo] = useState<string>();
  const [videos, setVideos] = useState<DisplayVideo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);
  const [role, setRole] = useState<"owner" | "editor">("editor");
  const [formVideo, setFormVideo] = useState<DisplayVideo | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  const loadDashboard = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    setEmail(auth.user.email ?? "");
    const [profileResult, projectResult, videosResult, memberResult, inviteResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("videos").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id, role, profiles(id, display_name, avatar_url, theme)").eq("project_id", projectId),
      supabase.from("project_invites").select("id, email").eq("project_id", projectId).order("created_at"),
    ]);
    if (projectResult.error) { router.replace("/projects"); return; }
    if (profileResult.data) { setProfile(profileResult.data as Profile); applyTheme((profileResult.data as Profile).theme); }
    const nextProject = projectResult.data as Project;
    setProject(nextProject);
    if (nextProject.image_path) {
      const { data } = await supabase.storage.from("project-media").createSignedUrl(nextProject.image_path, 3600);
      setProjectLogo(data?.signedUrl);
    } else setProjectLogo(undefined);
    const ownMembership = (memberResult.data ?? []).find(
      (item: { user_id: string }) => item.user_id === auth.user.id,
    );
    setRole((ownMembership?.role as "owner" | "editor") ?? "editor");
    setMembers((memberResult.data ?? []) as unknown as Member[]);
    setPendingInvites((inviteResult.data ?? []) as PendingInvite[]);
    const withUrls = await Promise.all(((videosResult.data ?? []) as Video[]).map(async (video) => {
      const { data } = await supabase.storage.from("project-media").createSignedUrl(video.thumbnail_path, 3600);
      return { ...video, thumbnailUrl: data?.signedUrl };
    }));
    setVideos(withUrls);
    setLoading(false);
  }, [projectId, router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authenticateRealtime(supabase).then((authenticated) => {
      if (cancelled || !authenticated) return;
      channel = supabase.channel(`project-${projectId}`, { config: { private: true } }).on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `project_id=eq.${projectId}` }, () => void loadDashboard()).on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${projectId}` }, () => void loadDashboard()).subscribe();
    });
    return () => { cancelled = true; window.clearTimeout(initialLoad); if (channel) void supabase.removeChannel(channel); };
  }, [loadDashboard, projectId, supabase]);

  useEffect(() => {
    const openFromLink = window.setTimeout(() => {
      if (window.location.hash === "#settings") setSettingsOpen(true);
    }, 0);
    return () => window.clearTimeout(openFromLink);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;
    let cancelled = false;

    async function updateActivity() {
      await supabase.from("project_presence").upsert({
        project_id: projectId,
        user_id: currentProfile.id,
        last_seen: new Date().toISOString(),
      });

      const activeSince = new Date(Date.now() - 45_000).toISOString();
      const { data } = await supabase
        .from("project_presence")
        .select("user_id")
        .eq("project_id", projectId)
        .gte("last_seen", activeSince);

      if (!cancelled) {
        setActiveUserIds(
          (data ?? [])
            .map((item: { user_id: string }) => item.user_id)
            .filter((id: string) => id !== currentProfile.id),
        );
      }
    }

    const initialActivity = window.setTimeout(() => void updateActivity(), 0);
    const heartbeat = window.setInterval(() => void updateActivity(), 20_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialActivity);
      window.clearInterval(heartbeat);
    };
  }, [profile, projectId, supabase]);

  async function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingVideo) return;
    setIsSavingVideo(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { setIsSavingVideo(false); return; }
    let thumbnailPath = formVideo?.thumbnail_path ?? "";
    let uploadedThumbnailPath: string | null = null;
    const thumbnail = data.get("thumbnail");
    if (thumbnail instanceof File && thumbnail.size > 0) {
      if (thumbnail.size > 3 * 1024 * 1024) { setError("Thumbnail must be 3 MB or smaller."); setIsSavingVideo(false); return; }
      const extension = thumbnail.name.split(".").pop() ?? "jpg";
      thumbnailPath = `${projectId}/videos/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("project-media").upload(thumbnailPath, thumbnail);
      if (uploadError) { setError(uploadError.message); setIsSavingVideo(false); return; }
      uploadedThumbnailPath = thumbnailPath;
    }
    if (!thumbnailPath) { setError("A thumbnail is required."); setIsSavingVideo(false); return; }
    const record = {
      project_id: projectId, title: String(data.get("title")).trim(), thumbnail_path: thumbnailPath,
      views: Number(data.get("views")), watch_hours: Number(data.get("watchHours")), ctr: Number(data.get("ctr")),
      avd: String(data.get("avd")).trim(), likes: Number(data.get("likes")), comments: Number(data.get("comments")),
      hype: String(data.get("hype") ?? "").trim() || null, created_by: user.id, updated_at: new Date().toISOString(),
      category: String(data.get("category") ?? "").trim() || null,
      notes: String(data.get("notes") ?? "").trim() || null,
      published_at: String(data.get("publishedAt") ?? "") || null,
    };
    const result = formVideo ? await supabase.from("videos").update(record).eq("id", formVideo.id) : await supabase.from("videos").insert(record);
    if (result.error) {
      if (uploadedThumbnailPath) await supabase.storage.from("project-media").remove([uploadedThumbnailPath]);
      setError(result.error.message); setIsSavingVideo(false); return;
    }
    if (formVideo && uploadedThumbnailPath && formVideo.thumbnail_path !== uploadedThumbnailPath) {
      await supabase.storage.from("project-media").remove([formVideo.thumbnail_path]);
    }
    setFormVideo(undefined);
    await loadDashboard();
    setIsSavingVideo(false);
  }

  async function deleteVideo(video: DisplayVideo) {
    if (!window.confirm(`Delete “${video.title}”? This cannot be undone.`)) return;
    setIsSavingVideo(true);
    setError("");
    const { error: deleteError } = await supabase.from("videos").delete().eq("id", video.id);
    if (deleteError) { setError(deleteError.message); setIsSavingVideo(false); return; }
    await supabase.storage.from("project-media").remove([video.thumbnail_path]);
    setFormVideo(undefined);
    await loadDashboard();
    setIsSavingVideo(false);
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const data = new FormData(event.currentTarget);
    const user = (await supabase.auth.getUser()).data.user;
    const inviteEmail = String(data.get("email") ?? "").trim().toLowerCase();
    if (!user) return;
    const { error: inviteError } = await supabase.from("project_invites").insert({ project_id: projectId, email: inviteEmail, role: "editor", invited_by: user.id });
    if (inviteError) { setError(inviteError.message); return; }
    formElement.reset();
    await loadDashboard();
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this person from the project?")) return;
    await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
    await loadDashboard();
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from("project_invites").delete().eq("id", inviteId);
    await loadDashboard();
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("projectName") ?? "").trim();
    const color = String(data.get("projectColor") ?? project.color);
    let imagePath = project.image_path;
    const image = data.get("projectImage");
    if (image instanceof File && image.size > 0) {
      if (image.size > 3 * 1024 * 1024) { setError("Project logo must be 3 MB or smaller."); return; }
      imagePath = `${projectId}/project/logo`;
      const upload = await supabase.storage.from("project-media").upload(imagePath, image, { upsert: true });
      if (upload.error) { setError(upload.error.message); return; }
    }
    const { error: updateError } = await supabase.from("projects").update({ name, color, image_path: imagePath, updated_at: new Date().toISOString() }).eq("id", projectId);
    if (updateError) { setError(updateError.message); return; }
    if (project.image_path && project.image_path !== imagePath) {
      await supabase.storage.from("project-media").remove([project.image_path]);
    }
    await loadDashboard();
  }

  async function deleteOrLeaveProject() {
    if (!profile || !project) return;
    const wording = role === "owner" ? "Delete this project for everyone? This cannot be undone." : "Leave this project?";
    if (!window.confirm(wording)) return;
    if (role === "owner") {
      const mediaPaths = [project.image_path, ...videos.map((video) => video.thumbnail_path)].filter((path): path is string => Boolean(path));
      if (mediaPaths.length) await supabase.storage.from("project-media").remove([...new Set(mediaPaths)]);
      await supabase.from("projects").delete().eq("id", projectId);
    } else await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", profile.id);
    router.replace("/projects");
  }

  if (loading || !profile || !project) return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Loading project</main>;

  return (
    <main className="page-shell flex-1 text-[var(--foreground)]">
      <AppHeader profile={profile} email={email} logoUrl={projectLogo}>
        <div className="hidden items-center -space-x-2 sm:flex" aria-label={`${activeUserIds.length} other active collaborators`}>
          {activeUserIds.slice(0, 4).map((userId) => { const membership = members.find((item) => item.user_id === userId); const person = Array.isArray(membership?.profiles) ? membership.profiles[0] : membership?.profiles; return <span key={userId} title={`${person?.display_name ?? "Collaborator"} is active`} className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[var(--background)] bg-cyan-500 text-center text-xs font-bold leading-8 text-white">{person?.avatar_url ? <Image src={person.avatar_url} alt={person.display_name} fill unoptimized className="object-cover" /> : person?.display_name?.charAt(0)}</span>; })}
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} className="button-secondary hidden sm:inline-flex">Project settings</button>
      </AppHeader>
      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="animate-enter flex flex-wrap items-center justify-between gap-3"><Link href="/projects" className="back-button"><span aria-hidden="true">‹</span> Projects</Link><div className="flex items-center gap-2"><div className="flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm"><span className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)]">Videos</span><Link href={`/projects/${projectId}/analytics`} className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]">Analytics</Link></div><button type="button" onClick={() => setSettingsOpen(true)} className="button-secondary sm:hidden">Settings</button></div></div>
        <div className="animate-rise mt-10"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Videos</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{project.name}</h1><p className="mt-4 text-[var(--muted)]">Keep your video stats and notes together.</p></div>

        {formVideo !== undefined && (
          <VideoForm video={formVideo} onSubmit={saveVideo} onCancel={() => { setFormVideo(undefined); setError(""); }} onDelete={deleteVideo} error={error} isSaving={isSavingVideo} />
        )}

        <section className="stagger mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <button type="button" onClick={() => setFormVideo(null)} className="premium-card group flex min-h-96 flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-8 transition hover:-translate-y-2 hover:border-orange-500 hover:shadow-2xl">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/10 text-4xl text-orange-500">+</span><span className="mt-5 text-lg font-bold">Add video</span><span className="mt-2 text-sm text-[var(--muted)]">Track another upload</span>
          </button>
          {videos.map((video) => <VideoCard key={video.id} video={video} onClick={() => setFormVideo(video)} />)}
        </section>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/50 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="my-8 w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl">
            <div className="flex justify-between gap-4"><div><h2 className="text-2xl font-bold">Project settings</h2><p className="mt-2 text-sm text-[var(--muted)]">Update the project or invite someone to it.</p></div><button onClick={() => setSettingsOpen(false)} className="self-start text-[var(--muted)]">Close</button></div>
            {role === "owner" && <form onSubmit={updateProject} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Project title<input name="projectName" required maxLength={100} defaultValue={project.name} className={inputClass} /></label><label className="block text-sm font-semibold">Project logo <span className="font-normal text-[var(--muted)]">(shown in the header)</span><input name="projectImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className={inputClass} /></label><label className="block text-sm font-semibold">Accent color<input name="projectColor" type="color" defaultValue={project.color} className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1" /></label><button className="button-primary">Save project</button></form>}
            <h3 className="mt-8 font-bold">Invite an editor</h3>
            {role === "owner" ? <form onSubmit={invite} className="mt-6 flex gap-2"><input required name="email" type="email" className={inputClass} placeholder="friend@example.com" /><button className="mt-2 rounded-xl bg-orange-500 px-4 font-semibold text-white">Invite</button></form> : <p className="mt-6 rounded-xl bg-orange-500/10 p-4 text-sm">Only the project owner can invite people.</p>}
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="mt-6 space-y-2"><h3 className="text-sm font-semibold text-[var(--muted)]">People with access</h3>{members.map((member) => { const person = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles; return <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"><span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-orange-500 text-white">{person?.avatar_url ? <Image src={person.avatar_url} alt="" width={36} height={36} unoptimized /> : person?.display_name?.charAt(0)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person?.display_name ?? "Member"}</p><p className="text-xs capitalize text-[var(--muted)]">{member.role}</p></div>{role === "owner" && member.role !== "owner" && <button onClick={() => removeMember(member.user_id)} className="text-xs text-red-500">Remove</button>}</div>; })}{pendingInvites.map((pending) => <div key={pending.id} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--background)]">✉</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{pending.email}</p><p className="text-xs text-[var(--muted)]">Invitation pending</p></div>{role === "owner" && <button onClick={() => cancelInvite(pending.id)} className="text-xs text-red-500">Cancel</button>}</div>)}</div>
            <div className="mt-8 border-t border-[var(--border)] pt-6"><button onClick={deleteOrLeaveProject} className="text-sm font-semibold text-red-500">{role === "owner" ? "Delete project" : "Leave project"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function VideoCard({ video, onClick }: { video: DisplayVideo; onClick: () => void }) {
  const stats = [["Views", numberFormatter.format(video.views)], ["Watch Hours", numberFormatter.format(video.watch_hours)], ["CTR", `${video.ctr}%`], ["AVD", video.avd], ["Likes", numberFormatter.format(video.likes)], ["Comments", numberFormatter.format(video.comments)], ...(video.hype ? [["Hype", video.hype]] : [])];
  return <button type="button" onClick={onClick} className="premium-card group overflow-hidden rounded-[2rem] text-left transition hover:-translate-y-2 hover:shadow-2xl"><div className="relative aspect-video overflow-hidden bg-gradient-to-br from-orange-400 to-rose-500">{video.thumbnailUrl && <Image src={video.thumbnailUrl} alt={`${video.title} thumbnail`} fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.035]" />}{video.category && <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur">{video.category}</span>}</div><div className="p-5"><h2 className="min-h-14 text-lg font-bold leading-7">{video.title}</h2><dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="rounded-xl bg-orange-500/[0.07] px-3 py-2.5"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-sm font-bold">{value}</dd></div>)}</dl>{video.notes && <p className="mt-4 line-clamp-2 border-t border-[var(--border)] pt-4 text-sm leading-6 text-[var(--muted)]">{video.notes}</p>}</div></button>;
}

function VideoForm({ video, onSubmit, onCancel, onDelete, error, isSaving }: { video: DisplayVideo | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; onDelete: (video: DisplayVideo) => void; error: string; isSaving: boolean }) {
  return <form onSubmit={onSubmit} className="premium-card animate-rise mt-8 grid gap-5 rounded-[2rem] p-6 shadow-xl lg:grid-cols-2"><div className="lg:col-span-2"><div className="flex justify-between gap-4"><div><h2 className="text-2xl font-black tracking-tight">{video ? "Edit video" : "Add video"}</h2><p className="mt-1 text-sm text-[var(--muted)]">Stats are required. Category, date, and notes are optional.</p></div><button type="button" disabled={isSaving} onClick={onCancel} className="button-secondary self-start disabled:opacity-50">Close</button></div></div><label className="text-sm font-semibold lg:col-span-2">Title<input className={inputClass} name="title" required maxLength={200} defaultValue={video?.title} /></label><label className="text-sm font-semibold lg:col-span-2">Thumbnail {video && <span className="font-normal text-[var(--muted)]">(choose only to replace)</span>}<input className={inputClass} name="thumbnail" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required={!video} /></label><NumberInput name="views" label="Views" value={video?.views} /><NumberInput name="watchHours" label="Watch Hours" value={video?.watch_hours} step="0.1" /><NumberInput name="ctr" label="CTR (%)" value={video?.ctr} step="0.1" /><label className="text-sm font-semibold">AVD<input className={inputClass} name="avd" required placeholder="3:03" defaultValue={video?.avd} /></label><NumberInput name="likes" label="Likes" value={video?.likes} /><NumberInput name="comments" label="Comments" value={video?.comments} /><label className="text-sm font-semibold">Category <span className="font-normal text-[var(--muted)]">(optional)</span><input className={inputClass} name="category" maxLength={80} placeholder="Essay, tutorial, review" defaultValue={video?.category ?? ""} /></label><label className="text-sm font-semibold">Published date <span className="font-normal text-[var(--muted)]">(optional)</span><input className={inputClass} name="publishedAt" type="date" defaultValue={video?.published_at ?? ""} /></label><label className="text-sm font-semibold lg:col-span-2">Notes <span className="font-normal text-[var(--muted)]">(optional)</span><textarea className={`${inputClass} min-h-28 resize-y`} name="notes" maxLength={4000} placeholder="Add anything you want to remember about this video" defaultValue={video?.notes ?? ""} /></label><label className="text-sm font-semibold lg:col-span-2">Hype <span className="font-normal text-[var(--muted)]">(optional)</span><input className={inputClass} name="hype" defaultValue={video?.hype ?? ""} /></label>{error && <p className="text-sm text-red-500 lg:col-span-2">{error}</p>}<div className="flex gap-3 lg:col-span-2"><button disabled={isSaving} className="button-primary flex-1 disabled:opacity-60">{isSaving ? "Saving" : video ? "Save changes" : "Add video"}</button>{video && <button type="button" disabled={isSaving} onClick={() => onDelete(video)} className="rounded-xl border border-red-500/30 px-5 py-3 font-semibold text-red-500 disabled:opacity-50">Delete video</button>}</div></form>;
}

function NumberInput({ name, label, value, step = "1" }: { name: string; label: string; value?: number; step?: string }) {
  return <label className="text-sm font-semibold">{label}<input className={inputClass} name={name} type="number" min="0" step={step} required defaultValue={value} /></label>;
}
