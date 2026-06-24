import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/rapide/AppShell";
import { MapIcon, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dispatcher")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: "/dispatcher" } });
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    const hasAccess = roles?.some(r => r.role === "dispatcher" || r.role === "admin" || r.role === "super_admin");
    if (!hasAccess) {
      throw redirect({ to: "/" });
    }
  },
  component: DispatcherLayout,
});

function DispatcherLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
