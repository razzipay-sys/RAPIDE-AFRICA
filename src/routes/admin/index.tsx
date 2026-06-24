import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bike, Package, Clock, CheckCircle, XCircle, Search, Users, MapIcon,
  TrendingUp, AlertTriangle, DollarSign, Ban,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";
import { LiveMap } from "@/components/rapide/LiveMap";
import type { RiderPin } from "@/components/rapide/LiveMap";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminOps,
});

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${color ?? "bg-primary/10"}`}>
        <Icon className={`h-5 w-5 ${color ? "text-white" : "text-primary"}`} />
      </div>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </motion.div>
  );
}

function AdminOps() {
  const qc = useQueryClient();

  const { data: riderStats } = useQuery({
    queryKey: ["admin-riders"],
    queryFn: async () => {
      const { data } = await supabase.from("riders").select("is_online, kyc_status");
      const total = data?.length ?? 0;
      const online = data?.filter((r) => r.is_online).length ?? 0;
      const pendingKyc = data?.filter((r) => r.kyc_status === "pending").length ?? 0;
      return { total, online, pendingKyc };
    },
    refetchInterval: 15000,
  });

  const { data: orderStats } = useQuery({
    queryKey: ["admin-order-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status, price_xof, created_at");
      const now = new Date();
      const today = data?.filter((o) => new Date(o.created_at).toDateString() === now.toDateString()) ?? [];
      const delivered = data?.filter((o) => o.status === "delivered") ?? [];
      const totalRevenue = delivered.reduce((s, o) => s + Number(o.price_xof), 0);
      const todayRevenue = today.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.price_xof), 0);
      const avgValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;
      return {
        searching: data?.filter((o) => o.status === "searching_rider").length ?? 0,
        active: data?.filter((o) =>
          ["rider_assigned", "rider_arriving", "picked_up", "in_transit"].includes(o.status),
        ).length ?? 0,
        delivered: delivered.length,
        cancelled: data?.filter((o) => o.status === "cancelled").length ?? 0,
        todayRevenue,
        todayOrders: today.length,
        totalRevenue,
        avgValue,
      };
    },
    refetchInterval: 15000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, status, price_xof, created_at, pickup_address, dropoff_address, rider_id")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const { data: pendingKycRiders } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select("id, user_id, vehicle_type, license_plate, kyc_status, created_at")
        .eq("kyc_status", "pending")
        .order("created_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: onlineRiders } = useQuery({
    queryKey: ["admin-online-riders-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select("id, current_lat, current_lng")
        .eq("is_online", true)
        .not("current_lat", "is", null);
      return (data ?? []).filter((r) => r.current_lat && r.current_lng).map<RiderPin>((r) => ({
        id: r.id,
        lat: Number(r.current_lat),
        lng: Number(r.current_lng),
      }));
    },
    refetchInterval: 12000,
  });

  const { data: activeOrders } = useQuery({
    queryKey: ["admin-active-orders-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status")
        .in("status", ["rider_assigned", "rider_arriving", "picked_up", "in_transit"]);
      
      return (data ?? []).map((o) => ({
        id: o.id,
        pickup: { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) },
        dropoff: { lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng) },
      }));
    },
    refetchInterval: 12000,
  });

  // 7-day revenue trend + user count
  const { data: trendStats } = useQuery({
    queryKey: ["admin-revenue-trend"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [ordersRes, usersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("created_at, price_xof, status")
          .gte("created_at", sevenDaysAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const orders = ordersRes.data ?? [];
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split("T")[0];
        const dayOrders = orders.filter((o) => o.created_at.startsWith(dateStr));
        trend.push({
          day: d.toLocaleDateString("fr-FR", { weekday: "short" }),
          revenue: dayOrders
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + Number(o.price_xof), 0),
          orders: dayOrders.length,
        });
      }
      return { trend, userCount: usersRes.count ?? 0 };
    },
    refetchInterval: 60000,
  });

  // Orders stuck in searching_rider for >10 min
  const { data: stuckOrders } = useQuery({
    queryKey: ["admin-stuck-orders"],
    queryFn: async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id, code, pickup_address, dropoff_address, price_xof, created_at")
        .eq("status", "searching_rider")
        .lt("created_at", tenMinAgo)
        .order("created_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("admin-ops-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-order-stats"] });
        qc.invalidateQueries({ queryKey: ["admin-recent-orders"] });
        qc.invalidateQueries({ queryKey: ["admin-stuck-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-riders"] });
      })
      .subscribe();
    return () => { void ch.unsubscribe(); };
  }, [qc]);

  const approveKyc = async (riderId: string) => {
    await supabase.from("riders").update({ kyc_status: "approved" }).eq("id", riderId);
    qc.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-riders"] });
    toast.success("KYC approved");
  };

  const rejectKyc = async (riderId: string) => {
    await supabase.from("riders").update({ kyc_status: "rejected" }).eq("id", riderId);
    qc.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
    toast.success("KYC rejected");
  };

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
      await supabase.from("order_events").insert({
        order_id: orderId,
        status: "cancelled",
        note: "Cancelled by admin",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-stuck-orders"] });
      toast.success("Order cancelled");
    },
    onError: () => toast.error("Failed to cancel order"),
  });

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-yellow-400",
    searching_rider: "text-blue-400",
    rider_assigned: "text-blue-400",
    rider_arriving: "text-blue-400",
    picked_up: "text-primary",
    in_transit: "text-primary",
    delivered: "text-green-400",
    cancelled: "text-destructive",
    failed: "text-destructive",
  };

  const ACTIVE_STATUSES = new Set(["pending", "searching_rider", "rider_assigned", "rider_arriving", "picked_up", "in_transit"]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Operations</h1>
        <p className="text-muted-foreground text-sm mt-1">Live platform overview</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Bike}
          label="Riders Online"
          value={`${riderStats?.online ?? 0} / ${riderStats?.total ?? 0}`}
          sub={`${riderStats?.pendingKyc ?? 0} pending KYC`}
        />
        <StatCard icon={Search} label="Searching Rider" value={orderStats?.searching ?? 0} color="bg-blue-500" />
        <StatCard icon={Package} label="Active Orders" value={orderStats?.active ?? 0} color="bg-primary" />
        <StatCard
          icon={CheckCircle}
          label="Today Delivered"
          value={orderStats?.delivered ?? 0}
          sub={fmtXOF(orderStats?.todayRevenue ?? 0)}
          color="bg-green-500"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Today Revenue"
          value={fmtXOF(orderStats?.todayRevenue ?? 0)}
          sub={`${orderStats?.todayOrders ?? 0} orders today`}
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={trendStats?.userCount ?? "—"}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Order Value"
          value={orderStats?.avgValue ? fmtXOF(orderStats.avgValue) : "—"}
        />
        <StatCard
          icon={Ban}
          label="Cancelled"
          value={orderStats?.cancelled ?? 0}
          color="bg-destructive"
        />
      </div>

      {/* Revenue 7-day trend */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Revenue — 7 days
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {fmtXOF(trendStats?.trend.reduce((s, d) => s + d.revenue, 0) ?? 0)}
          </span>
        </h2>
        <div className="glass rounded-2xl p-4" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendStats?.trend ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.2 45)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.2 45)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,10,0.92)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => [fmtXOF(v), "Revenue"]}
                labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="oklch(0.72 0.2 45)"
                fill="url(#revenueGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "oklch(0.72 0.2 45)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Needs Attention */}
      {(stuckOrders?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Needs Attention
            <span className="ml-2 text-xs font-normal text-yellow-400/80">
              {stuckOrders?.length} order{(stuckOrders?.length ?? 0) > 1 ? "s" : ""} searching &gt;10 min
            </span>
          </h2>
          <div className="space-y-2">
            {stuckOrders?.map((o) => {
              const minAgo = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
              return (
                <div key={o.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3 border border-yellow-400/20">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs glass rounded-full px-2 py-0.5">{o.code}</span>
                      <span className="text-xs text-yellow-400">{minAgo}m waiting</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.pickup_address} → {o.dropoff_address}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">{fmtXOF(o.price_xof)}</span>
                    <button
                      onClick={() => cancelOrderMutation.mutate(o.id)}
                      disabled={cancelOrderMutation.isPending}
                      className="flex items-center gap-1 rounded-lg bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20 transition"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Riders Map */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-primary" />
          Live Orders & Riders
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {onlineRiders?.length ?? 0} online · {activeOrders?.length ?? 0} active
          </span>
        </h2>
        <LiveMap riders={onlineRiders ?? []} activeOrders={activeOrders ?? []} height={340} zoom={12} />
      </section>

      {/* KYC Pending */}
      {(pendingKycRiders?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-400" />
            Pending KYC Approvals
            <span className="ml-2 text-xs font-normal text-yellow-400/80">
              {pendingKycRiders?.length} waiting
            </span>
          </h2>
          <div className="space-y-2">
            {pendingKycRiders?.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bike className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <p className="text-sm font-medium capitalize">
                      {r.vehicle_type} · {r.license_plate ?? "No plate"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{r.user_id.slice(0, 12)}…</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveKyc(r.id)}
                    className="flex items-center gap-1 rounded-lg bg-green-500/10 text-green-400 px-3 py-1.5 text-xs font-semibold hover:bg-green-500/20 transition"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => rejectKyc(r.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20 transition"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Orders */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Orders
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Route</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right">Time</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders?.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-mono text-xs">{o.code}</td>
                  <td className="py-3 max-w-[180px]">
                    <p className="truncate text-xs">{o.pickup_address}</p>
                    <p className="truncate text-xs text-muted-foreground">→ {o.dropoff_address}</p>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs font-medium capitalize ${STATUS_COLOR[o.status] ?? ""}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-xs">{fmtXOF(o.price_xof)}</td>
                  <td className="py-3 text-right text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 text-right">
                    {ACTIVE_STATUSES.has(o.status) && (
                      <button
                        onClick={() => cancelOrderMutation.mutate(o.id)}
                        disabled={cancelOrderMutation.isPending}
                        className="text-xs text-destructive/70 hover:text-destructive transition"
                        title="Cancel order"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
