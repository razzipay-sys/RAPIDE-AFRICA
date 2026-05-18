import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Moon, Sun, Languages, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useT();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center font-display text-2xl font-bold text-primary-foreground">
          {(profile?.full_name?.[0] ?? user?.email?.[0] ?? "R").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold truncate">{profile?.full_name ?? t("profile.user")}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
        </div>
      </header>

      <div className="glass rounded-2xl divide-y divide-border">
        <button onClick={toggle} className="w-full p-4 flex items-center gap-3 text-left">
          {theme === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
          <span className="flex-1 text-sm">{t("profile.theme")}</span>
          <span className="text-xs text-muted-foreground capitalize">{theme}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={() => setLang(lang === "fr" ? "en" : "fr")} className="w-full p-4 flex items-center gap-3 text-left">
          <Languages className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm">{t("profile.language")}</span>
          <span className="text-xs text-muted-foreground">{lang.toUpperCase()}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <button
        onClick={async () => { await signOut(); navigate({ to: "/" }); }}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-destructive">
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-medium">{t("profile.signout")}</span>
      </button>
    </div>
  );
}
