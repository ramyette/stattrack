"use client";

import { useEffect, useState } from "react";
import { applyTheme } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/app";

export default function ThemeToggle({ profile }: { profile: Profile }) {
  const [isDark, setIsDark] = useState(profile.theme === "dark");

  useEffect(() => {
    const syncTheme = window.setTimeout(
      () => setIsDark(document.documentElement.classList.contains("dark")),
      0,
    );
    return () => window.clearTimeout(syncTheme);
  }, []);

  async function toggleTheme() {
    const nextTheme: Profile["theme"] = isDark ? "light" : "dark";
    setIsDark(!isDark);
    applyTheme(nextTheme);
    await createClient().from("profiles").update({ theme: nextTheme }).eq("id", profile.id);
  }

  return (
    <button type="button" onClick={toggleTheme} className="icon-button" aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} title={isDark ? "Light theme" : "Dark theme"}>
      <span aria-hidden="true">{isDark ? "☀" : "◐"}</span>
    </button>
  );
}
