import { Link, useLocation } from "@tanstack/react-router";
import { Home, Package, Wallet, User, Plus, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { NotificationBell } from "@/components/rapide/NotificationBell";
import rapideLogo from "@/assets/rapide-logo.jpg";

type TabDef = {
  to: string;
  icon: typeof Home;
  labelKey: "tab.home" | "tab.orders" | "tab.send" | "tab.wallet" | "tab.profile" | "tab.chat";
  primary?: boolean;
};

const tabDefs: TabDef[] = [
  { to: "/app", icon: Home, labelKey: "tab.home" },
  { to: "/app/orders", icon: Package, labelKey: "tab.orders" },
  { to: "/app/book", icon: Plus, labelKey: "tab.send", primary: true },
  { to: "/app/chat", icon: MessageCircle, labelKey: "tab.chat" },
  { to: "/app/profile", icon: User, labelKey: "tab.profile" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top header */}
      <div className="fixed top-0 inset-x-0 z-30 px-4 py-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <Link to="/app" className="flex items-center gap-2">
            <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-base font-bold tracking-tight">Rapide</span>
          </Link>
        </div>
        <div className="pointer-events-auto">
          <NotificationBell />
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-16">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="glass-strong mx-auto flex max-w-2xl items-center justify-between rounded-2xl px-2 py-2 shadow-elegant">
          {tabDefs.map((tab) => {
            const active = pathname === tab.to || (tab.to !== "/app" && pathname.startsWith(tab.to));
            const Icon = tab.icon;
            if (tab.primary) {
              return (
                <Link key={tab.to} to={tab.to} className="flex flex-col items-center -mt-6">
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
                className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
