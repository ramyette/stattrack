import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Keep every video organized",
    description: "Save views, watch hours, CTR, average view duration, likes, comments, thumbnails, and notes in one place.",
  },
  {
    title: "Understand performance",
    description: "Compare videos and review project analytics to see what is connecting with your audience.",
  },
  {
    title: "Share when you want",
    description: "Use StatTrack on your own or invite someone to a project when you want to work together.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex-1 overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute left-[-10rem] top-[-12rem] h-96 w-96 rounded-full bg-orange-400/15 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-48 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3 font-black tracking-tight" aria-label="StatTrack home">
          <span className="relative h-10 w-10 overflow-hidden rounded-[14px] shadow-lg shadow-orange-500/20">
            <Image src="/icon.svg" alt="" fill priority className="object-cover" />
          </span>
          <span className="text-xl">StatTrack</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link href="/login" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-lg">Sign in</Link>
          <Link href="/projects" className="hidden rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-bold text-[var(--background)] transition hover:-translate-y-0.5 hover:shadow-lg sm:inline-flex">Open dashboard</Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-12 lg:pb-28">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-500">YouTube statistics, organized</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-[-0.055em] sm:text-6xl lg:text-7xl">Learn what works on your channel.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            StatTrack is a standalone dashboard for recording YouTube video performance, comparing results, and finding useful patterns in your content.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-2xl bg-orange-500 px-6 py-3.5 font-black text-white shadow-xl shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600">Get started with Google</Link>
            <Link href="/legal#privacy" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 font-bold transition hover:-translate-y-0.5 hover:shadow-lg">How your data is handled</Link>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">Free during public beta. No payment information required.</p>
        </div>

        <div className="premium-card relative rounded-[2rem] p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--muted)]">Channel overview</p>
              <p className="mt-1 text-2xl font-black">Your performance at a glance</p>
            </div>
            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[["Views", "82.4K"], ["Watch hours", "6.1K"], ["Average CTR", "5.6%"], ["Videos", "5"]].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex h-28 items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 pb-4 pt-6" aria-label="Example performance chart">
            {[38, 58, 44, 72, 60, 88, 78, 100, 84, 94].map((height, index) => (
              <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-orange-500 to-rose-400" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-[var(--border)] bg-[var(--surface)]/50 px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-500">Built for a clearer workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your spreadsheet, with room to think.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="premium-card rounded-3xl p-6">
                <h3 className="text-xl font-black">{feature.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
