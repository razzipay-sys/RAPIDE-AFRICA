import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/rapide/AppShell";
import { HeadphonesIcon, User, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/support")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: "/support" } });
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    const hasAccess = roles?.some(r => r.role === "support" || r.role === "admin" || r.role === "super_admin");
    if (!hasAccess) {
      throw redirect({ to: "/" });
    }
  },
  component: SupportLayout,
});

function SupportLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
