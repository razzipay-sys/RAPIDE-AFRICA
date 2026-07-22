import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  Users,
  Bike,
  HeadphonesIcon,
  Tag,
} from "lucide-react";
import { requireRoleAccess } from "@/lib/platform-routing";
import { PortalShell } from "@/components/rapide/PortalShell";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location, context }) => {
    await requireRoleAccess({
      queryClient: context.queryClient,
      location,
      allowedRoles: ["admin", "super_admin"],
    });
  },
  component: AdminLayout,
});

const navItems = [
  { to: "/admin/", icon: LayoutDashboard, label: "Ops" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/drivers", icon: Bike, label: "Drivers" },
  { to: "/admin/finance", icon: DollarSign, label: "Finance" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/promotions", icon: Tag, label: "Promotions" },
  { to: "/support", icon: HeadphonesIcon, label: "Support" },
];

function AdminLayout() {
  return (
    <AuthProvider>
      <PortalShell title="Rapide Admin" navItems={navItems}>
        <Outlet />
      </PortalShell>
    </AuthProvider>
  );
}
