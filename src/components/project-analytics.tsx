"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime";
import type { Profile, Project, Video } from "@/types/app";

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function avdSeconds(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export default function ProjectAnalytics({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [projectLogo, setProjectLogo] = useState<string>();
  const [videos, setVideos] = useState<Video[]>([]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    setEmail(auth.user.email ?? "");
    const [profileResult, projectResult, videoResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("videos").select("*").eq("project_id", projectId).order("views", { ascending: false }),
    ]);
    if (projectResult.error) { router.replace("/projects"); return; }
    const nextProject = projectResult.data as Project;
    setProject(nextProject);
    setVideos((videoResult.data ?? []) as Video[]);
    if (profileResult.data) { setProfile(profileResult.data as Profile); applyTheme((profileResult.data as Profile).theme); }
    if (nextProject.image_path) {
      const { data } = await supabase.storage.from("project-media").createSignedUrl(nextProject.image_path, 3600);
      setProjectLogo(data?.signedUrl);
    }
  }, [projectId, router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authenticateRealtime(supabase).then((authenticated) => {
      if (cancelled || !authenticated) return;
      channel = supabase.channel(`analytics-${projectId}`, { config: { private: true } }).on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `project_id=eq.${projectId}` }, () => void load()).subscribe();
    });
    return () => { cancelled = true; window.clearTimeout(initialLoad); if (channel) void supabase.removeChannel(channel); };
  }, [load, projectId, supabase]);

  const analytics = useMemo(() => {
    const totalViews = videos.reduce((sum, video) => sum + Number(video.views), 0);
    const totalWatch = videos.reduce((sum, video) => sum + Number(video.watch_hours), 0);
    const totalLikes = videos.reduce((sum, video) => sum + Number(video.likes), 0);
    const totalComments = videos.reduce((sum, video) => sum + Number(video.comments), 0);
    const averageCtr = videos.length ? videos.reduce((sum, video) => sum + Number(video.ctr), 0) / videos.length : 0;
    const averageAvd = videos.length ? videos.reduce((sum, video) => sum + avdSeconds(video.avd), 0) / videos.length : 0;
    const byEngagement = [...videos].sort((a, b) => engagement(b) - engagement(a));
    const categories = new Map<string, Video[]>();
    videos.forEach((video) => {
      const key = video.category?.trim() || "Uncategorized";
      categories.set(key, [...(categories.get(key) ?? []), video]);
    });
    const categoryRows = [...categories.entries()].map(([name, items]) => ({
      name, count: items.length,
      averageViews: items.reduce((sum, video) => sum + Number(video.views), 0) / items.length,
      averageCtr: items.reduce((sum, video) => sum + Number(video.ctr), 0) / items.length,
      averageEngagement: items.reduce((sum, video) => sum + engagement(video), 0) / items.length,
    })).sort((a, b) => b.averageViews - a.averageViews);
    return { totalViews, totalWatch, totalLikes, totalComments, averageCtr, averageAvd, byEngagement, categoryRows };
  }, [videos]);

  if (!profile || !project) return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Loading analytics</main>;
  const maxViews = Math.max(...videos.map((video) => Number(video.views)), 1);
  const maxCtr = Math.max(...videos.map((video) => Number(video.ctr)), 1);
  const strongestCtr = [...videos].sort((a, b) => Number(b.ctr) - Number(a.ctr))[0];
  const strongestRetention = [...videos].sort((a, b) => avdSeconds(b.avd) - avdSeconds(a.avd))[0];

  return (
    <main className="page-shell flex-1 text-[var(--foreground)]">
      <AppHeader profile={profile} email={email} logoUrl={projectLogo}>
        <Link href={`/projects/${projectId}#settings`} className="button-secondary hidden sm:inline-flex">Project settings</Link>
      </AppHeader>
      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="animate-enter flex flex-wrap items-center justify-between gap-3">
          <Link href="/projects" className="back-button"><span aria-hidden="true">‹</span> Projects</Link>
          <div className="flex items-center gap-2"><div className="flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm"><Link href={`/projects/${projectId}`} className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]">Videos</Link><span className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)]">Analytics</span></div><Link href={`/projects/${projectId}#settings`} className="button-secondary sm:hidden">Settings</Link></div>
        </div>

        <header className="animate-rise mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Analytics</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{project.name} analytics</h1>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">Charts based on the video stats saved in this project.</p>
        </header>

        {!videos.length ? <div className="premium-card animate-rise mt-10 rounded-[2rem] p-12 text-center"><h2 className="text-2xl font-bold">No analytics yet</h2><p className="mt-3 text-[var(--muted)]">Add a video to start seeing charts.</p><Link href={`/projects/${projectId}`} className="button-primary mt-6">Add a video</Link></div> : <>
          <section className="stagger mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total views" value={compact.format(analytics.totalViews)} detail={`${videos.length} tracked videos`} accent="from-orange-400 to-rose-500" />
            <Metric label="Watch hours" value={compact.format(analytics.totalWatch)} detail={`${number.format(Math.round(analytics.totalWatch))} hours`} accent="from-violet-500 to-fuchsia-500" />
            <Metric label="Average CTR" value={`${analytics.averageCtr.toFixed(1)}%`} detail="Across current videos" accent="from-cyan-400 to-blue-500" />
            <Metric label="Average AVD" value={formatDuration(analytics.averageAvd)} detail={`${compact.format(analytics.totalLikes)} likes · ${compact.format(analytics.totalComments)} comments`} accent="from-emerald-400 to-teal-500" />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
            <div className="premium-card animate-rise rounded-[2rem] p-6 sm:p-8"><SectionTitle eyebrow="Reach" title="Views leaderboard" description="Relative reach across every tracked upload." /><div className="mt-8 space-y-5">{videos.slice(0, 8).map((video, index) => <div key={video.id}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="truncate font-semibold"><span className="mr-3 text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>{video.title}</span><span className="shrink-0 font-mono font-bold">{compact.format(video.views)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full origin-left rounded-full bg-gradient-to-r from-orange-400 via-rose-500 to-violet-500 animate-[grow_.8s_cubic-bezier(.22,1,.36,1)_both]" style={{ width: `${Math.max((video.views / maxViews) * 100, 2)}%` }} /></div></div>)}</div></div>
            <div className="premium-card animate-rise rounded-[2rem] p-6 sm:p-8"><SectionTitle eyebrow="Response" title="Engagement leaders" description="Likes and comments as a share of views." /><ol className="mt-7 space-y-4">{analytics.byEngagement.slice(0, 6).map((video, index) => <li key={video.id} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 font-mono text-xs font-bold text-violet-500">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{video.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{number.format(video.likes + video.comments)} interactions</p></div><strong className="text-sm">{engagement(video).toFixed(1)}%</strong></li>)}</ol></div>
          </section>

          <section className="premium-card animate-rise mt-6 rounded-[2rem] p-6 sm:p-8"><SectionTitle eyebrow="Packaging vs. reach" title="CTR and views map" description="Videos toward the upper-right combine stronger click-through rate with larger reach." /><div className="mt-8 overflow-x-auto"><svg viewBox="0 0 900 330" className="min-w-[650px]" role="img" aria-label="Scatter plot of video click-through rate and views"><line x1="65" y1="280" x2="865" y2="280" stroke="currentColor" opacity=".15" /><line x1="65" y1="25" x2="65" y2="280" stroke="currentColor" opacity=".15" />{[0, .25, .5, .75, 1].map((tick) => <g key={tick}><line x1={65 + tick * 800} y1="280" x2={65 + tick * 800} y2="286" stroke="currentColor" opacity=".3" /><text x={65 + tick * 800} y="308" textAnchor="middle" fill="currentColor" opacity=".55" fontSize="12">{(tick * maxCtr).toFixed(1)}% CTR</text></g>)}{videos.map((video, index) => { const x = 65 + (Number(video.ctr) / maxCtr) * 800; const y = 280 - (Number(video.views) / maxViews) * 240; return <g key={video.id}><circle cx={x} cy={y} r={9 + Math.min(engagement(video), 8)} fill={index % 2 ? "#8b5cf6" : "#f45b69"} opacity=".82"><title>{video.title}: {video.ctr}% CTR, {number.format(video.views)} views</title></circle></g>; })}</svg></div></section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="premium-card animate-rise rounded-[2rem] p-6 sm:p-8"><SectionTitle eyebrow="Content mix" title="Performance by category" description="Add categories to videos to reveal repeatable topic patterns." /><div className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)]"><table className="w-full text-left text-sm"><thead className="bg-[var(--background)] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="p-4">Category</th><th className="p-4 text-right">Videos</th><th className="p-4 text-right">Avg. views</th><th className="hidden p-4 text-right sm:table-cell">Avg. CTR</th></tr></thead><tbody>{analytics.categoryRows.map((row) => <tr key={row.name} className="border-t border-[var(--border)]"><td className="p-4 font-semibold">{row.name}</td><td className="p-4 text-right">{row.count}</td><td className="p-4 text-right font-mono">{compact.format(row.averageViews)}</td><td className="hidden p-4 text-right font-mono sm:table-cell">{row.averageCtr.toFixed(1)}%</td></tr>)}</tbody></table></div></div>
            <div className="premium-card animate-rise rounded-[2rem] p-6 sm:p-8"><SectionTitle eyebrow="A closer look" title="Things worth checking" description="A few patterns from the numbers you entered." /><div className="mt-7 space-y-3">{strongestCtr && <Insight color="orange" label="Highest CTR" title={strongestCtr.title} body={`This video has a ${strongestCtr.ctr}% CTR. Compare its title and thumbnail with videos that received fewer clicks.`} />}{strongestRetention && <Insight color="violet" label="Longest average view" title={strongestRetention.title} body={`This video has an AVD of ${strongestRetention.avd}. Look at its opening, pacing, and topic when planning another video.`} />}{analytics.categoryRows[0] && <Insight color="cyan" label="Most viewed category" title={analytics.categoryRows[0].name} body={`Videos in this category average ${compact.format(analytics.categoryRows[0].averageViews)} views across ${analytics.categoryRows[0].count} video${analytics.categoryRows[0].count === 1 ? "" : "s"}. More videos will make this comparison more useful.`} />}</div></div>
          </section>
        </>}
      </div>
    </main>
  );
}

function engagement(video: Video) { return video.views ? ((Number(video.likes) + Number(video.comments)) / Number(video.views)) * 100 : 0; }
function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) { return <article className="premium-card relative overflow-hidden rounded-[1.6rem] p-6"><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} /><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--muted)]">{label}</p><p className="mt-4 text-4xl font-black tracking-[-.06em]">{value}</p><p className="mt-2 text-xs text-[var(--muted)]">{detail}</p></article>; }
function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-[-.035em]">{title}</h2><p className="mt-2 text-sm text-[var(--muted)]">{description}</p></div>; }
function Insight({ color, label, title, body }: { color: "orange" | "violet" | "cyan"; label: string; title: string; body: string }) { const colors = { orange: "bg-orange-500", violet: "bg-violet-500", cyan: "bg-cyan-500" }; return <article className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><div className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${colors[color]}`} /><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{label}</p><h3 className="mt-1 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p></div></div></article>; }
