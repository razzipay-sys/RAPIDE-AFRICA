import { createFileRoute, Outlet, Link, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { Home, Package, Wallet, User, FileText, ArrowLeft, LogOut } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { NotificationBell } from "@/components/rapide/NotificationBell";

async function handleSignOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export const Route = createFileRoute("/rider")({
  beforeLoad: async ({ location, context }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Ensure the user actually has the rider role
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
      
    const hasRole = roles.some((r: any) => r.role === "rider" || r.role === "admin");
    if (!hasRole) {
      throw redirect({ to: "/app" });
    }
  },
  component: RiderLayout,
});

const RIDER_TAB_ROOTS = new Set([
  "/rider/",
  "/rider/dispatch",
  "/rider/earnings",
  "/rider/documents",
  "/rider/profile",
]);

const tabs = [
  { to: "/rider", icon: Home, label: "Home" },
  { to: "/rider/dispatch", icon: Package, label: "Dispatch" },
  { to: "/rider/earnings", icon: Wallet, label: "Earnings" },
  { to: "/rider/documents", icon: FileText, label: "Docs" },
  { to: "/rider/profile", icon: User, label: "Profile" },
];

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.14 } },
};

function RiderLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const showBack = !RIDER_TAB_ROOTS.has(pathname);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate({ to: ".." as any });
    } else {
      navigate({ to: "/rider" });
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background pb-24">
        {/* Top header */}
        <div className="fixed top-0 inset-x-0 z-30 px-4 py-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <AnimatePresence mode="wait" initial={false}>
              {showBack ? (
                <motion.button
                  key="back"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleBack}
                  aria-label="Go back"
                  className="flex items-center gap-2 glass h-9 rounded-xl px-3 text-sm font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </motion.button>
              ) : (
                <motion.div
                  key="logo"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link to="/rider" className="flex items-center gap-2">
                    <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
                    <span className="font-display text-base font-bold tracking-tight">Rapide</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                      Rider
                    </span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-xl glass text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Page content with transition */}
        <main className="mx-auto max-w-2xl px-4 pt-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
          <div className="glass-strong mx-auto flex max-w-2xl items-center justify-between rounded-2xl px-2 py-2 shadow-elegant">
            {tabs.map((t) => {
              const active =
                pathname === t.to ||
                (t.to === "/rider" && pathname === "/rider/") ||
                (t.to !== "/rider" && pathname.startsWith(t.to));
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
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
