import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, Settings, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type PortalNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

type PortalShellProps = {
  title: string;
  navItems: PortalNavItem[];
  children: ReactNode;
};

async function handleSignOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

function PortalNav({
  title,
  navItems,
  pathname,
  onNavigate,
}: {
  title: string;
  navItems: PortalNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col h-full py-6 px-3">
      <div className="flex items-center gap-2 px-3 mb-8">
        <img src={rapideLogo} alt="Rapide" className="h-8 w-8 rounded-lg object-cover" />
        <span className="font-display font-bold text-sm">{title}</span>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const basePath = item.to.endsWith("/") ? item.to.slice(0, -1) : item.to;
          const active =
            pathname === item.to || pathname === basePath || pathname.startsWith(`${basePath}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to as any}
              onClick={onNavigate}
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
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Back to site
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function PortalShell({ title, navItems, children }: PortalShellProps) {
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile top bar — the fixed sidebar below is desktop/tablet only
          (md:flex), so this is the only way to reach nav on a phone
          (Section 19.2: was completely unreachable below md width). */}
      <div className="md:hidden flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={rapideLogo} alt="Rapide" className="h-7 w-7 rounded-lg object-cover" />
          <span className="font-display font-bold text-sm">{title}</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="h-9 w-9 rounded-xl glass flex items-center justify-center"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <PortalNav
            title={title}
            navItems={navItems}
            pathname={pathname}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <aside className="hidden md:flex w-60 shrink-0 border-r border-border">
        <PortalNav title={title} navItems={navItems} pathname={pathname} />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
