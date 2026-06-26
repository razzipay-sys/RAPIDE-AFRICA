import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/rapide/AppShell";
import { MapIcon, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dispatcher")({
  beforeLoad: async ({ location, context }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
    
    const roles = await context.queryClient.fetchQuery({
      queryKey: ["user_roles", data.session.user.id],
      queryFn: async () => {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        return rolesData ?? [];
      },
      staleTime: 1000 * 60 * 5,
    });

    const hasAccess = roles.some((r: any) => r.role === "dispatcher" || r.role === "admin" || r.role === "super_admin");
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
