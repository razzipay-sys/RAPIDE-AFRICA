import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean }> {
  const key = `${userId}:${action}`;
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Atomic check+insert via advisory lock — a plain check-then-insert here
  // let concurrent requests from the same user all read the same
  // pre-insert count and all pass.
  const { data: allowed, error } = await supabase.rpc("check_and_log_rate_limit", {
    p_user_action: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) throw error;

  // Fire-and-forget: prune old entries
  supabase
    .from("rate_limit_log")
    .delete()
    .eq("user_action", key)
    .lt("created_at", windowStart)
    .then(() => {});

  return { allowed: !!allowed };
}
