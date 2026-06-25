import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Package, Wallet, User, Plus, MessageCircle, ArrowLeft, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { NotificationBell } from "@/components/rapide/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import rapideLogo from "@/assets/rapide-logo.jpg";

type TabDef = {
  to: string;
  icon: typeof Home;
  labelKey: "tab.home" | "tab.orders" | "tab.send" | "tab.wallet" | "tab.profile" | "tab.chat";
  primary?: boolean;
};

const tabDefs: TabDef[] = [
  { to: "/app",         icon: Home,          labelKey: "tab.home" },
  { to: "/app/orders",  icon: Package,       labelKey: "tab.orders" },
  { to: "/app/book",    icon: Plus,          labelKey: "tab.send",    primary: true },
  { to: "/app/chat",    icon: MessageCircle, labelKey: "tab.chat" },
  { to: "/app/profile", icon: User,          labelKey: "tab.profile" },
];

// Routes that ARE top-level tabs — show logo, not back button
const TAB_ROOTS = new Set([
  "/app",
  "/app/orders",
  "/app/book",
  "/app/chat",
  "/app/profile",
  "/app/wallet",
]);

function isTabRoot(pathname: string) {
  return TAB_ROOTS.has(pathname);
}

/** Page transition variants — subtle fade-up */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.14 } },
};

async function handleSignOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useT();

  const showBack = !isTabRoot(pathname);

  const handleBack = () => {
    // Try browser history first; fall back to /app
    if (window.history.length > 1) {
      navigate({ to: ".." as any });
    } else {
      navigate({ to: "/app" });
    }
  };

  return (
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
                <span className="hidden sm:inline">{t("nav.back") ?? "Back"}</span>
              </motion.button>
            ) : (
              <motion.div
                key="logo"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
              >
                <Link to="/app" className="flex items-center gap-2">
                  <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
                  <span className="font-display text-base font-bold tracking-tight">Rapide</span>
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
          <motion.div
            variants={pageVariants}
            initial="initial"
            animate="enter"
          >
            {children}
          </motion.div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="glass-strong mx-auto flex max-w-2xl items-center justify-between rounded-2xl px-2 py-2 shadow-elegant">
          {tabDefs.map((tab) => {
            const active =
              pathname === tab.to ||
              (tab.to !== "/app" && pathname.startsWith(tab.to));
            const Icon = tab.icon;
            if (tab.primary) {
              return (
                <Link key={tab.to} to={tab.to} className="flex flex-col items-center -mt-6" aria-label={t(tab.labelKey)}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
                    <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                </Link>
              );
            }
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
