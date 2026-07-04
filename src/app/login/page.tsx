"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setIsLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--background)] px-5 text-[var(--foreground)]">
      <div className="absolute left-[-10rem] top-[-12rem] h-96 w-96 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl sm:p-10">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 font-black text-white">S</div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Welcome to StatTrack</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">Track your YouTube video stats in one place.</p>
        <button onClick={signIn} disabled={isLoading} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60">
          <span className="text-lg font-bold text-blue-500">G</span>
          {isLoading ? "Opening Google" : "Continue with Google"}
        </button>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">By continuing, you agree to StatTrack&apos;s <Link href="/legal#terms" className="font-semibold underline underline-offset-2">Terms</Link> and <Link href="/legal#privacy" className="font-semibold underline underline-offset-2">Privacy Policy</Link>.</p>
      </section>
    </main>
  );
}
