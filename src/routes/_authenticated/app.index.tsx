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
import { LiveMap } from "@/components/rapide/LiveMap";

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

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t("app.greeting.morning");
  if (h < 18) return t("app.greeting.afternoon");
  return t("app.greeting.evening");
}

const QUICK_ACTIONS = [
  { icon: Zap, labelKey: "app.quick.express", to: "/app/book", color: "bg-primary/15 text-primary" },
  { icon: Clock, labelKey: "app.quick.scheduled", to: "/app/book", color: "bg-blue-500/15 text-blue-400" },
  { icon: Shield, labelKey: "app.quick.insured", to: "/app/book", color: "bg-green-500/15 text-green-400" },
  { icon: MapPin, labelKey: "app.quick.track", to: "/app/orders", color: "bg-purple-500/15 text-purple-400" },
] as const;

function Home() {
  const { user } = useAuth();
  const { t } = useT();

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
        .select("id,code,status,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,price_xof,created_at")
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
  const greeting = getGreeting(t);
  const activeOrder = orders?.find((o) =>
    ["searching_rider", "rider_assigned", "rider_arriving", "picked_up", "in_transit"].includes(o.status)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="font-display text-3xl font-bold">
          {firstName || t("app.welcome")} 👋
        </h1>
      </motion.div>

      {/* Active order banner */}
      {activeOrder && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="block rounded-3xl bg-gradient-primary overflow-hidden shadow-glow">
            <div className="h-32 w-full relative z-0 pointer-events-none">
              <LiveMap 
                pickup={activeOrder.pickup_lng ? [activeOrder.pickup_lng, activeOrder.pickup_lat] : undefined} 
                dropoff={activeOrder.dropoff_lng ? [activeOrder.dropoff_lng, activeOrder.dropoff_lat] : undefined}
                height={128}
                zoom={11}
                showRoute={true}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-transparent" />
            </div>
            
            <Link
              to="/app/track/$orderId"
              params={{ orderId: activeOrder.id }}
              className="block p-4 relative z-10 -mt-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-bold text-primary-foreground/90 uppercase tracking-wider">
                      {t("app.active_trip")}
                    </span>
                  </div>
                  <p className="font-display text-base font-bold text-primary-foreground">
                    {activeOrder.pickup_address} → {activeOrder.dropoff_address}
                  </p>
                  <p className="text-xs text-primary-foreground/80 mt-0.5">
                    {activeOrder.code} · {fmtXOF(activeOrder.price_xof)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeOrder.status} className="bg-white/20 text-primary-foreground border-white/30 backdrop-blur-md" />
                  <ArrowRight className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
            </Link>
          </div>
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
              <span className="text-[10px] font-semibold text-center text-muted-foreground uppercase tracking-wider">
                {t(action.labelKey)}
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

      {/* Recent Activity Timeline */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">{t("app.recent_orders")}</h2>
          <Link to="/app/orders" className="text-xs text-primary font-medium">{t("app.see_all")}</Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <SkeletonOrderCard key={i} />)}
          </div>
        ) : orders?.length ? (
          <div className="relative pl-3">
            <div className="absolute left-[21px] top-4 bottom-4 w-px bg-white/10" />
            <div className="space-y-4">
              {orders.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 + i * 0.05 }}
                  className="relative"
                >
                  <Link
                    to="/app/track/$orderId"
                    params={{ orderId: o.id }}
                    className="flex items-center gap-4 group"
                  >
                    <div className="relative z-10 h-10 w-10 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors">
                      <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    </div>
                    <div className="flex-1 glass rounded-2xl p-4 group-hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground font-mono">{o.code}</p>
                          <StatusDot status={o.status} />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">
                          {o.pickup_address} <br/>
                          <span className="text-muted-foreground">↓ {o.dropoff_address}</span>
                        </p>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gradient-primary">{fmtXOF(o.price_xof)}</p>
                          <StatusBadge status={o.status} className="text-[9px] px-1.5 py-0 mt-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
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
