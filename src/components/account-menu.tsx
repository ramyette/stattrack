"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/app";

export function applyTheme(theme: Profile["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("stattrack-theme", theme);
}

export default function AccountMenu({ profile, email }: { profile: Profile; email: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 pr-4 shadow-sm transition hover:shadow-md" aria-expanded={open}>
        <span className="relative h-9 w-9 overflow-hidden rounded-full bg-orange-500 text-center leading-9 text-white">
          {profile.avatar_url ? <Image src={profile.avatar_url} alt="" fill unoptimized className="object-cover" /> : profile.display_name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{profile.display_name}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-2xl">
          <div className="border-b border-[var(--border)] px-3 py-3">
            <p className="truncate font-semibold">{profile.display_name}</p>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">{email}</p>
          </div>
          <Link href="/settings" className="mt-2 block rounded-xl px-3 py-2.5 text-sm hover:bg-orange-500/10">Account settings</Link>
          <button type="button" onClick={signOut} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-orange-500/10">Sign out</button>
        </div>
      )}
    </div>
  );
}
