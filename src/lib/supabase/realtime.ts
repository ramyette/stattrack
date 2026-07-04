import type { SupabaseClient } from "@supabase/supabase-js";

export async function authenticateRealtime(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return false;

  await supabase.realtime.setAuth(session.access_token);
  return true;
}
