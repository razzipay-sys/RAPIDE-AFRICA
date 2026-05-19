import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight, Bike, Package, Wallet, Zap, MapPin, Clock, Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { StatusBadge, StatusDot } from "@/components/rapide/StatusBadge";
import { SkeletonOrderCard, SkeletonStatCard } from "@/components/rapide/SkeletonCard";

export const Route = createFileRoute("/_authenticated/app/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    // Check for elevated roles and redirect to their home dashboard
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id);

    const roleList = (roles ?? []).map((r) => r.role);
    if (roleList.includes("admin")) throw redirect({ to: "/admin/" as any });
    if (roleList.includes("rider")) throw redirect({ to: "/rider" as any });
  },
  component: Home,
});

function getGreeting(lang: string): string {
  const h = new Date().getHours();
  if (h < 12) return lang === "fr" ? "Bonjour" : "Good morning";
  if (h < 18) return lang === "fr" ? "Bon après-midi" : "Good afternoon";
  return lang === "fr" ? "Bonsoir" : "Good evening";
}

const QUICK_ACTIONS = [
  { icon: Zap, labelFr: "Express", labelEn: "Express", to: "/app/book", color: "bg-primary/15 text-primary" },
  { icon: Clock, labelFr: "Programmé", labelEn: "Scheduled", to: "/app/book", color: "bg-blue-500/15 text-blue-400" },
  { icon: Shield, labelFr: "Assuré", labelEn: "Insured", to: "/app/book", color: "bg-green-500/15 text-green-400" },
  { icon: MapPin, labelFr: "Suivre", labelEn: "Track", to: "/app/orders", color: "bg-purple-500/15 text-purple-400" },
] as const;

function Home() {
  const { user } = useAuth();
  const { t, lang } = useT();

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance_xof").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["recent-orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,code,status,pickup_address,dropoff_address,price_xof,created_at")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { count: ridersOnline } = await supabase
        .from("riders")
        .select("*", { count: "exact", head: true })
        .eq("is_online", true);
      return { ridersOnline: ridersOnline ?? 0 };
    },
    staleTime: 60000,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const greeting = getGreeting(lang);
  const activeOrder = orders?.find((o) =>
    ["searching_rider", "rider_assigned", "rider_arriving", "picked_up", "in_transit"].includes(o.status)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="font-display text-3xl font-bold">
          {firstName || (lang === "fr" ? "Bienvenue" : "Welcome")} 👋
        </h1>
      </motion.div>

      {/* Active order banner */}
      {activeOrder && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Link
            to="/app/track/$orderId"
            params={{ orderId: activeOrder.id }}
            className="block rounded-3xl bg-gradient-primary p-4 shadow-glow"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-bold text-primary-foreground/80 uppercase tracking-wider">
                    {lang === "fr" ? "Course en cours" : "Active trip"}
                  </span>
                </div>
                <p className="font-display text-base font-bold text-primary-foreground">
                  {activeOrder.pickup_address} → {activeOrder.dropoff_address}
                </p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                  {activeOrder.code} · {fmtXOF(activeOrder.price_xof)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={activeOrder.status} className="bg-white/20 text-primary-foreground border-white/30" />
                <ArrowRight className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Wallet card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Link to="/app/wallet" className="block glass-strong rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-radial opacity-50 pointer-events-none" />
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("app.wallet_label")}</p>
              {walletLoading ? (
                <div className="mt-1 h-9 w-32 animate-pulse rounded-lg bg-white/5" />
              ) : (
                <p className="mt-1 font-display text-3xl font-bold text-gradient-primary">
                  {fmtXOF(wallet?.balance_xof ?? 0)}
                </p>
              )}
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Send parcel CTA */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Link to="/app/book" className="block rounded-3xl bg-gradient-primary p-5 shadow-glow group">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary-foreground/70 text-xs uppercase tracking-wider mb-1">
                <Zap className="h-3.5 w-3.5" /> {t("app.send_label")}
              </div>
              <p className="font-display text-xl font-bold text-primary-foreground">{t("app.send_title")}</p>
              <p className="text-sm text-primary-foreground/70 mt-0.5">{t("app.send_sub")}</p>
            </div>
            <motion.div
              whileHover={{ x: 4 }}
              className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center"
            >
              <ArrowRight className="h-5 w-5 text-primary-foreground" />
            </motion.div>
          </div>
        </Link>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
          >
            <Link to={action.to} className="flex flex-col items-center gap-1.5">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {lang === "fr" ? action.labelFr : action.labelEn}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <Bike className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-xl font-bold">{stats?.ridersOnline ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("app.riders_online")}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-xl font-bold">99.2%</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("app.on_time")}</p>
        </motion.div>
      </div>

      {/* Recent orders */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">{t("app.recent_orders")}</h2>
          <Link to="/app/orders" className="text-xs text-primary font-medium">{t("app.see_all")}</Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <SkeletonOrderCard key={i} />)}
          </div>
        ) : orders?.length ? (
          <div className="space-y-2">
            {orders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.05 }}
              >
                <Link
                  to="/app/track/$orderId"
                  params={{ orderId: o.id }}
                  className="flex items-center gap-3 glass rounded-2xl p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground font-mono">{o.code}</p>
                      <StatusDot status={o.status} />
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5">
                      {o.pickup_address} → {o.dropoff_address}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmtXOF(o.price_xof)}</p>
                    <StatusBadge status={o.status} className="text-[9px] px-1.5 py-0 mt-0.5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("app.no_orders")}</p>
            <Link
              to="/app/book"
              className="mt-3 inline-block rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
            >
              {t("app.send_title")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
