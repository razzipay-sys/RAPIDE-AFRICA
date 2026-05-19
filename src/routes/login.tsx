import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/app" }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect as any });
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("login.toast_welcome"));

    // Role-based redirect only when no specific page was requested
    if (search.redirect === "/app" && authData.user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (roleData?.role === "admin") {
        navigate({ to: "/admin/" as any });
        return;
      }
      if (roleData?.role === "rider") {
        navigate({ to: "/rider" as any });
        return;
      }
    }
    navigate({ to: search.redirect as any });
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: (import.meta.env.VITE_APP_URL || window.location.origin) + "/app" },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full max-w-md rounded-3xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <img src={rapideLogo} alt="Rapide" className="h-10 w-10 rounded-xl object-cover shadow-glow" />
          <span className="font-display text-lg font-bold">Rapide</span>
        </Link>
        <h1 className="font-display text-2xl font-bold">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>

        <button onClick={signInWithGoogle} className="mt-6 w-full rounded-xl glass px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition">
          {t("login.google")}
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> {t("login.or")} <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password" required placeholder={t("login.password")} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button disabled={loading} className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("login.btn")}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("login.no_account")} <Link to="/signup" className="text-primary font-medium">{t("login.create")}</Link>
        </p>
      </motion.div>
    </div>
  );
}
