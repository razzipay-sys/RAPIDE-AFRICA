import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/rapide/AppShell";
import { AuthProvider } from "@/hooks/use-auth";
import { requireRoleAccess } from "@/lib/platform-routing";

export const Route = createFileRoute("/support")({
  beforeLoad: async ({ location, context }) => {
    await requireRoleAccess({
      queryClient: context.queryClient,
      location,
      allowedRoles: ["support", "admin"],
    });
  },
  component: SupportLayout,
});

function SupportLayout() {
  return (
    <AuthProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthProvider>
  );
}
