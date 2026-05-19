import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${userId}:${action}`;
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_action", key)
    .gte("created_at", windowStart);

  const current = count ?? 0;

  if (current >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  await supabase.from("rate_limit_log").insert({ user_action: key });

  // Fire-and-forget: prune old entries
  supabase
    .from("rate_limit_log")
    .delete()
    .eq("user_action", key)
    .lt("created_at", windowStart)
    .then(() => {});

  return { allowed: true, remaining: maxRequests - current - 1 };
}
