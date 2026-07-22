import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { sanitizeAuthError } from "@/lib/auth-errors";
import { fetchUserRolesSafe, getRoleHome } from "@/lib/platform-routing";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function useSignupSchema() {
  const { t } = useT();
  return useMemo(
    () =>
      z.object({
        fullName: z.string().trim().min(1, t("signup.err.fullname_required")),
        phone: z.string().trim().min(1, t("signup.err.phone_required")),
        email: z.string().trim().email(t("signup.err.email_invalid")),
        password: z.string().min(8, t("signup.err.password_short")),
      }),
    [t],
  );
}

type SignupFormValues = z.infer<ReturnType<typeof useSignupSchema>>;

function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const [checkingSession, setCheckingSession] = useState(true);

  const signupSchema = useSignupSchema();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", phone: "", email: "", password: "" },
  });

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          const roles = await fetchUserRolesSafe(queryClient, data.session.user.id);
          navigate({ to: getRoleHome(roles) as any });
        }
      } catch {
        // Ignore session-check failures and let the form render.
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate, queryClient]);

  const signup = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: window.location.origin + "/app",
          data: { full_name: values.fullName, phone: values.phone, locale: lang },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.session) {
        toast.success(t("signup.toast_success"));
        navigate({ to: "/app" });
      } else {
        toast.success(t("signup.toast_verify"));
      }
    },
    onError: (error) => toast.error(sanitizeAuthError(error, lang as "fr" | "en")),
  });

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback?redirect=/app",
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) toast.error(sanitizeAuthError(error, lang as "fr" | "en"));
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4 py-10">
        <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
          {t("signup.title")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
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
        <h1 className="font-display text-2xl font-bold">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signup.subtitle")}</p>

        <button
          onClick={google}
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
          {t("signup.google")}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> {t("login.or")}{" "}
          <div className="h-px flex-1 bg-border" />
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => signup.mutate(values))}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="name"
                      placeholder={t("signup.fullname")}
                      className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="tel"
                      placeholder={t("signup.phone")}
                      className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("signup.password_hint")}
                      className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button
              type="submit"
              disabled={signup.isPending}
              className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {signup.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("signup.btn")}
            </button>
          </form>
        </Form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("signup.has_account")}{" "}
          <Link to="/login" search={{ redirect: "/app" }} className="text-primary font-medium">
            {t("signup.login")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
