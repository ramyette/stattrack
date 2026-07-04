"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime";
import type { Profile, Project } from "@/types/app";

type ProjectWithImage = Project & { imageUrl?: string };
const colors = ["#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#eab308"];

export default function ProjectsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [projects, setProjects] = useState<ProjectWithImage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadProjects = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    setEmail(auth.user.email ?? "");
    const [{ data: profileData }, { data: projectData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    ]);
    if (profileData) { setProfile(profileData as Profile); applyTheme((profileData as Profile).theme); }
    const withImages = await Promise.all(((projectData ?? []) as Project[]).map(async (project) => {
      if (!project.image_path) return project;
      const { data } = await supabase.storage.from("project-media").createSignedUrl(project.image_path, 3600);
      return { ...project, imageUrl: data?.signedUrl };
    }));
    setProjects(withImages);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadProjects(), 0);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authenticateRealtime(supabase).then((authenticated) => {
      if (cancelled || !authenticated) return;
      channel = supabase.channel("projects-list", { config: { private: true } }).on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => void loadProjects()).on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, () => void loadProjects()).subscribe();
    });
    return () => { cancelled = true; window.clearTimeout(initialLoad); if (channel) void supabase.removeChannel(channel); };
  }, [loadProjects, supabase]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { setIsCreating(false); return; }
    const name = String(formData.get("name") ?? "").trim();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const image = formData.get("image");
    if (image instanceof File && image.size > 3 * 1024 * 1024) {
      setError("Project image must be 3 MB or smaller.");
      setIsCreating(false);
      return;
    }
    const { data: project, error: insertError } = await supabase.from("projects").insert({ name, color, owner_id: user.id }).select().single();
    if (insertError || !project) { setError(insertError?.message ?? "Could not create project."); setIsCreating(false); return; }
    if (image instanceof File && image.size > 0) {
      const path = `${project.id}/project/logo`;
      const { error: uploadError } = await supabase.storage.from("project-media").upload(path, image);
      if (!uploadError) await supabase.from("projects").update({ image_path: path }).eq("id", project.id);
    }
    router.push(`/projects/${project.id}`);
  }

  if (loading || !profile) return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Loading projects</main>;

  return (
    <main className="page-shell flex-1 text-[var(--foreground)]">
      <AppHeader profile={profile} email={email} />
      <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="animate-enter flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><h1 className="text-5xl font-black tracking-[-0.06em] sm:text-6xl">Your projects</h1><p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">Keep each channel or set of videos in its own project.</p></div>
          <button type="button" onClick={() => setShowForm(true)} className="button-primary px-6 py-3.5">Create project <span aria-hidden="true">＋</span></button>
        </div>

        {showForm && (
          <form onSubmit={createProject} className="premium-card animate-rise mt-10 grid gap-5 rounded-[2rem] p-6 shadow-xl sm:grid-cols-2">
            <label className="text-sm font-semibold">Project name<input name="name" required maxLength={100} autoFocus className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-orange-500" placeholder="My channel" /></label>
            <label className="text-sm font-semibold">Picture <span className="font-normal text-[var(--muted)]">(optional)</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm" /></label>
            {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
            <div className="flex gap-3 sm:col-span-2"><button disabled={isCreating} className="button-primary disabled:opacity-60">{isCreating ? "Creating" : "Create project"}</button><button type="button" disabled={isCreating} onClick={() => setShowForm(false)} className="button-secondary">Cancel</button></div>
          </form>
        )}

        <section className="stagger mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id} className="premium-card group overflow-hidden rounded-[2rem] transition hover:-translate-y-2 hover:shadow-2xl">
              <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundColor: project.color }}>{project.imageUrl ? <Image src={project.imageUrl} alt="" fill unoptimized className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.35),transparent_35%)]" />}</div>
              <div className="flex items-center justify-between gap-4 p-6"><div><h2 className="text-xl font-black tracking-tight">{project.name}</h2><p className="mt-2 text-sm text-[var(--muted)]">View videos and analytics</p></div><span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] text-xl transition group-hover:translate-x-1 group-hover:bg-[var(--foreground)] group-hover:text-[var(--background)]">›</span></div>
            </Link>
          ))}
          {!projects.length && !showForm && <div className="rounded-3xl border-2 border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)] sm:col-span-2 lg:col-span-3">Create your first project to start tracking videos.</div>}
        </section>
      </div>
    </main>
  );
}
