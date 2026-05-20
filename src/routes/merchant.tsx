import { createFileRoute, Outlet, Link, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { LayoutDashboard, Package, Key, FileText, LogOut } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";

export const Route = createFileRoute("/merchant")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .in("role", ["merchant", "admin"])
      .maybeSingle();
    if (!role) {
      throw redirect({ to: "/" });
    }
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
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background flex">
        <aside className="w-56 shrink-0 border-r border-border flex flex-col py-6 px-3">
          <div className="flex items-center gap-2 px-3 mb-8">
            <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display font-bold text-sm">Rapide Merchant</span>
          </div>
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const active =
                pathname === item.to ||
                (item.to !== "/merchant/" && pathname.startsWith(item.to));
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
            <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground">
              ← Back to site
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
        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
