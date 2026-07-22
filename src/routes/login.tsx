import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, useCallback, useMemo, memo, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { sanitizeAuthError, normalizeSafeRedirect } from "@/lib/auth-errors";
import { fetchUserRolesSafe, getPostAuthRedirect } from "@/lib/platform-routing";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) || "/app",
  }),
  beforeLoad: async ({ search, context }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const dest = normalizeSafeRedirect(search.redirect as string, "/app");
    const roles = await fetchUserRolesSafe(context.queryClient, data.session.user.id);
    throw redirect({ to: getPostAuthRedirect(dest, roles) as any });
  },
  component: memo(LoginPage),
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatches and initial render issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const safeRedirect = useMemo(
    () => normalizeSafeRedirect(search.redirect as string, "/app"),
    [search.redirect],
  );

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;

      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(sanitizeAuthError(error, lang as "fr" | "en"));
          setLoading(false);
          return;
        }

        const { data: refreshedSession } = await supabase.auth.getSession();
        if (!refreshedSession.session) {
          toast.error(sanitizeAuthError("Unable to establish a session", lang as "fr" | "en"));
          setLoading(false);
          return;
        }

        toast.success(t("login.toast_welcome"));
        const roles = await fetchUserRolesSafe(queryClient, refreshedSession.session.user.id);
        navigate({ to: getPostAuthRedirect(safeRedirect, roles) as any });
      } catch (error) {
        toast.error(sanitizeAuthError(error, lang as "fr" | "en"));
      } finally {
        setLoading(false);
      }
    },
    [email, password, safeRedirect, navigate, queryClient, t, lang],
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback?redirect=/app",
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) toast.error(sanitizeAuthError(error, lang as "fr" | "en"));
    } catch (error) {
      toast.error(sanitizeAuthError(error, lang as "fr" | "en"));
    }
  }, [lang]);

  // Don't render anything until mounted to prevent hydration issues
  if (!isMounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="glass-strong w-full max-w-md rounded-3xl p-8"
      >
        <Link to="/" className="flex items-center gap-2 mb-6">
          <img
            src={rapideLogo}
            alt="Rapide"
            className="h-10 w-10 rounded-xl object-cover shadow-glow"
          />
          <span className="font-display text-lg font-bold">Rapide</span>
        </Link>
        <h1 className="font-display text-2xl font-bold">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>

        <button
          onClick={signInWithGoogle}
          className="mt-6 w-full rounded-xl glass px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {t("login.google")}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> {t("login.or")}{" "}
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Email"
            value={email}
            onChange={handleEmailChange}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder={t("login.password")}
            value={password}
            onChange={handlePasswordChange}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("login.btn")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("login.no_account")}{" "}
          <Link to="/signup" className="text-primary font-medium">
            {t("login.create")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
