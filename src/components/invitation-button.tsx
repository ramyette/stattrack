"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime";

export default function InvitationButton() {
  const supabase = createClient();
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { count: inviteCount } = await supabase
      .from("project_invites")
      .select("id", { count: "exact", head: true })
      .or(`recipient_id.eq.${auth.user.id},email.eq.${auth.user.email ?? ""}`);
    setCount(inviteCount ?? 0);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCount(), 0);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authenticateRealtime(supabase).then((authenticated) => {
      if (cancelled || !authenticated) return;
      channel = supabase
        .channel("my-invitations", { config: { private: true } })
        .on("postgres_changes", { event: "*", schema: "public", table: "project_invites" }, () => void loadCount())
        .subscribe();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadCount, supabase]);

  return (
    <Link href="/invitations" className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg shadow-sm transition hover:shadow-md" aria-label={`${count} pending invitations`} title="Invitations">
      <span aria-hidden="true">✉</span>
      {count > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
