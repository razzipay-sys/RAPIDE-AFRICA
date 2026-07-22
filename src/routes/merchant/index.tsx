import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, TrendingUp, CheckCircle, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { RIDER_ACTIVE_STATUSES, isSuccessfulDelivery } from "@/lib/order-lifecycle";

export const Route = createFileRoute("/merchant/")({
  component: MerchantDashboard,
});

function MerchantDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["merchant-stats", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, price_xof, created_at")
        .eq("customer_id", user!.id);
      const total = data?.length ?? 0;
      const delivered = data?.filter((o) => isSuccessfulDelivery(o.status)).length ?? 0;
      const spend =
        data
          ?.filter((o) => isSuccessfulDelivery(o.status))
          .reduce((s, o) => s + Number(o.price_xof), 0) ?? 0;
      const active =
        data?.filter((o) => ["pending", "searching_rider", ...RIDER_ACTIVE_STATUSES].includes(o.status))
          .length ?? 0;
      return { total, delivered, spend, active };
    },
    enabled: !!user,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["merchant-recent", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, status, price_xof, created_at, pickup_address, dropoff_address")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Merchant Portal</p>
          <h1 className="font-display text-3xl font-bold">{profile?.full_name ?? "Welcome"}</h1>
        </div>
        <Link
          to="/merchant/bulk"
          className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Package className="h-4 w-4" /> New Bulk Order
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: "Total Shipments", value: stats?.total ?? 0 },
          { icon: CheckCircle, label: "Delivered", value: stats?.delivered ?? 0 },
          { icon: Clock, label: "Active Now", value: stats?.active ?? 0 },
          { icon: TrendingUp, label: "Total Spend", value: fmtXOF(stats?.spend ?? 0) },
        ].map(({ icon: Icon, label, value }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4"
          >
            <Icon className="h-4 w-4 text-primary mb-2" />
            <p className="font-display text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            to: "/merchant/bulk",
            label: "Bulk CSV Upload",
            desc: "Upload thousands of orders at once",
            icon: Package,
          },
          {
            to: "/merchant/api-keys",
            label: "API Integration",
            desc: "Manage API keys for your system",
            icon: Clock,
          },
          {
            to: "/merchant/invoicing",
            label: "Invoices",
            desc: "Download monthly invoices as PDF",
            icon: TrendingUp,
          },
        ].map(({ to, label, desc, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="glass-strong rounded-2xl p-4 flex items-center justify-between hover:border-primary/30 border border-border transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      {/* Recent shipments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Recent Shipments</h2>
        </div>
        {recentOrders?.length === 0 ? (
          <p className="text-sm text-muted-foreground glass rounded-2xl p-4">No shipments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Route</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders?.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-3 font-mono text-xs">{o.code}</td>
                    <td className="py-3 max-w-[200px]">
                      <p className="truncate text-xs">{o.pickup_address}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        → {o.dropoff_address}
                      </p>
                    </td>
                    <td className="py-3">
                      <span className="text-xs capitalize glass rounded-full px-2 py-0.5">
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-xs">{fmtXOF(o.price_xof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
