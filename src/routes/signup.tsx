import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { full_name: fullName, phone, locale: lang },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success(t("signup.toast_success"));
      navigate({ to: "/app" });
    } else {
      toast.success(t("signup.toast_verify"));
    }
  };

  const google = async () => {
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: (import.meta.env.VITE_APP_URL || window.location.origin) + "/app" } });
    if (oauthErr) toast.error(oauthErr.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full max-w-md rounded-3xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <img src={rapideLogo} alt="Rapide" className="h-10 w-10 rounded-xl object-cover shadow-glow" />
          <span className="font-display text-lg font-bold">Rapide</span>
        </Link>
        <h1 className="font-display text-2xl font-bold">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signup.subtitle")}</p>

        <button onClick={google} className="mt-6 w-full rounded-xl glass px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition">
          {t("signup.google")}
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> {t("login.or")} <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input required placeholder={t("signup.fullname")} value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input required placeholder={t("signup.phone")} value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input type="password" required minLength={8} placeholder={t("signup.password_hint")} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <button disabled={loading} className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("signup.btn")}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("signup.has_account")} <Link to="/login" className="text-primary font-medium">{t("signup.login")}</Link>
        </p>
      </motion.div>
    </div>
  );
}
