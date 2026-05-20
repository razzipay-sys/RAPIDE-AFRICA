import { createFileRoute, Outlet, Link, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { Home, Package, Wallet, User, FileText } from "lucide-react";

export const Route = createFileRoute("/rider")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Ensure the user actually has the rider role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .in("role", ["rider", "admin"])
      .maybeSingle();
    if (!role) {
      throw redirect({ to: "/app" });
    }
  },
  component: RiderLayout,
});

const tabs = [
  { to: "/rider/", icon: Home, label: "Home" },
  { to: "/rider/dispatch", icon: Package, label: "Dispatch" },
  { to: "/rider/earnings", icon: Wallet, label: "Earnings" },
  { to: "/rider/documents", icon: FileText, label: "Docs" },
  { to: "/rider/profile", icon: User, label: "Profile" },
];

function RiderLayout() {
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background pb-24">
        <main className="mx-auto max-w-2xl px-4 pt-6">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
          <div className="glass-strong mx-auto flex max-w-2xl items-center justify-between rounded-2xl px-2 py-2 shadow-elegant">
            {tabs.map((t) => {
              const active = pathname === t.to || (t.to !== "/rider/" && pathname.startsWith(t.to));
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </AuthProvider>
  );
}
