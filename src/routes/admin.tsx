import { createFileRoute, Outlet, Link, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { LayoutDashboard, DollarSign, BarChart3, Settings, Users, Bike, HeadphonesIcon, LogOut } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Check admin role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    if (!role) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

const navItems = [
  { to: "/admin/", icon: LayoutDashboard, label: "Ops" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/drivers", icon: Bike, label: "Drivers" },
  { to: "/admin/finance", icon: DollarSign, label: "Finance" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/support", icon: HeadphonesIcon, label: "Support" },
];

function AdminLayout() {
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border flex flex-col py-6 px-3">
          <div className="flex items-center gap-2 px-3 mb-8">
            <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display font-bold text-sm">Rapide Admin</span>
          </div>
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const active = pathname === item.to || (item.to !== "/admin/" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Back to site
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
