import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSafeRedirect } from "@/lib/auth-errors";
import { fetchUserRolesSafe, getPostAuthRedirect } from "@/lib/platform-routing";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) || "/app",
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;
    const redirectTo = normalizeSafeRedirect(search.redirect as string, "/app");

    const finish = async (target: string, userId?: string) => {
      const roles = userId ? await fetchUserRolesSafe(queryClient, userId) : undefined;
      const resolvedTarget = roles ? getPostAuthRedirect(target, roles) : target;

      if (!cancelled) {
        navigate({ to: resolvedTarget as any });
      }
    };

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setStatus("Redirecting to your dashboard...");
        void finish(redirectTo);
      }
    }, 1200);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) {
        window.clearTimeout(timeout);
        void finish(redirectTo, session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!cancelled) {
        if (error) {
          setStatus("We could not finish sign-in. Please try again.");
          return;
        }

        if (data.session) {
          window.clearTimeout(timeout);
          void finish(redirectTo, data.session.user.id);
        }
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, queryClient, search.redirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center">
        <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
