import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { LayoutDashboard, Package, Key, FileText } from "lucide-react";
import { requireRoleAccess } from "@/lib/platform-routing";
import { PortalShell } from "@/components/rapide/PortalShell";

export const Route = createFileRoute("/merchant")({
  beforeLoad: async ({ location, context }) => {
    await requireRoleAccess({
      queryClient: context.queryClient,
      location,
      allowedRoles: ["merchant"],
    });
  },
  component: MerchantLayout,
});

const navItems = [
  { to: "/merchant/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/merchant/bulk", icon: Package, label: "Bulk Orders" },
  { to: "/merchant/api-keys", icon: Key, label: "API Keys" },
  { to: "/merchant/invoicing", icon: FileText, label: "Invoicing" },
];

function MerchantLayout() {
  return (
    <AuthProvider>
      <PortalShell title="Rapide Merchant" navItems={navItems}>
        <Outlet />
      </PortalShell>
    </AuthProvider>
  );
}
