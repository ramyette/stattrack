import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 text-[var(--foreground)]">
        <section className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">StatTrack setup</p>
          <h1 className="mt-3 text-3xl font-bold">Connect Supabase to continue</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            The app structure is ready. Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase project URL and publishable key, then restart the development server.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/projects" : "/login");
}
