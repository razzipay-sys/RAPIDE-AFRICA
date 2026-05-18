import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Bike, Package, Wallet, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { t } = useT();

  const { data: wallet } = useQuery({
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

  const { data: orders } = useQuery({
    queryKey: ["recent-orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id,code,status,pickup_address,dropoff_address,price_xof,created_at")
        .eq("customer_id", user!.id).order("created_at", { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "👋";

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">{t("app.hello")}</p>
        <h1 className="font-display text-3xl font-bold">{firstName}</h1>
      </motion.div>

      <Link to="/app/wallet" className="block glass-strong rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial opacity-60 pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("app.wallet_label")}</p>
            <p className="mt-1 font-display text-3xl font-bold text-gradient-primary">{fmtXOF(wallet?.balance_xof ?? 0)}</p>
          </div>
          <Wallet className="h-8 w-8 text-primary" />
        </div>
      </Link>

      <Link to="/app/book" className="block rounded-3xl bg-gradient-primary p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 text-xs uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" /> {t("app.send_label")}
            </div>
            <p className="mt-1 font-display text-xl font-bold text-primary-foreground">{t("app.send_title")}</p>
            <p className="text-sm text-primary-foreground/80">{t("app.send_sub")}</p>
          </div>
          <ArrowRight className="h-6 w-6 text-primary-foreground" />
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <Bike className="h-5 w-5 text-primary" />
          <p className="mt-2 font-display text-lg font-bold">240+</p>
          <p className="text-xs text-muted-foreground">{t("app.riders_online")}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <Package className="h-5 w-5 text-primary" />
          <p className="mt-2 font-display text-lg font-bold">99.2%</p>
          <p className="text-xs text-muted-foreground">{t("app.on_time")}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-bold">{t("app.recent_orders")}</h2>
          <Link to="/app/orders" className="text-xs text-primary">{t("app.see_all")}</Link>
        </div>
        {orders?.length ? (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to="/app/track/$orderId" params={{ orderId: o.id }} className="block glass rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{o.code}</p>
                      <p className="text-sm font-medium truncate">{o.pickup_address} → {o.dropoff_address}</p>
                    </div>
                    <span className="text-xs rounded-full glass-strong px-2.5 py-1 capitalize">{o.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground glass rounded-2xl p-4">{t("app.no_orders")}</p>
        )}
      </section>
    </div>
  );
}
