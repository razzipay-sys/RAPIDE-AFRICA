import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MapIcon } from "lucide-react";
import { PortalShell } from "@/components/rapide/PortalShell";
import { requireRoleAccess } from "@/lib/platform-routing";

export const Route = createFileRoute("/dispatcher")({
  beforeLoad: async ({ location, context }) => {
    await requireRoleAccess({
      queryClient: context.queryClient,
      location,
      allowedRoles: ["dispatcher"],
    });
  },
  component: DispatcherLayout,
});

function DispatcherLayout() {
  return (
    <PortalShell
      title="Rapide Dispatch"
      navItems={[{ to: "/dispatcher/", icon: MapIcon, label: "Live Dispatch" }]}
    >
      <Outlet />
    </PortalShell>
  );
}
