import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Bike, Package, Clock, CheckCircle, XCircle, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";

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
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
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
      return {
        searching: data?.filter((o) => o.status === "searching_rider").length ?? 0,
        active: data?.filter((o) =>
          ["rider_assigned", "rider_arriving", "picked_up", "in_transit"].includes(o.status),
        ).length ?? 0,
        delivered: data?.filter((o) => o.status === "delivered").length ?? 0,
        cancelled: data?.filter((o) => o.status === "cancelled").length ?? 0,
        todayRevenue: today.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.price_xof), 0),
        todayOrders: today.length,
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

  // Realtime subscription for live order updates
  useEffect(() => {
    const ch = supabase
      .channel("admin-ops-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-order-stats"] });
        qc.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-riders"] });
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [qc]);

  const approveKyc = async (riderId: string) => {
    await supabase.from("riders").update({ kyc_status: "approved" }).eq("id", riderId);
    qc.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
  };

  const rejectKyc = async (riderId: string) => {
    await supabase.from("riders").update({ kyc_status: "rejected" }).eq("id", riderId);
    qc.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
  };

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Operations</h1>
        <p className="text-muted-foreground text-sm mt-1">Live platform overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Bike}
          label="Riders Online"
          value={`${riderStats?.online ?? 0} / ${riderStats?.total ?? 0}`}
          sub={`${riderStats?.pendingKyc ?? 0} pending KYC`}
        />
        <StatCard
          icon={Search}
          label="Searching Rider"
          value={orderStats?.searching ?? 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={Package}
          label="Active Orders"
          value={orderStats?.active ?? 0}
          color="bg-primary"
        />
        <StatCard
          icon={CheckCircle}
          label="Today Delivered"
          value={orderStats?.delivered ?? 0}
          sub={fmtXOF(orderStats?.todayRevenue ?? 0)}
          color="bg-green-500"
        />
      </div>

      {/* KYC Pending */}
      {(pendingKycRiders?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-400" />
            Pending KYC Approvals
          </h2>
          <div className="space-y-2">
            {pendingKycRiders?.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{r.user_id.slice(0, 8)}…</p>
                  <p className="text-sm font-medium capitalize">
                    {r.vehicle_type} · {r.license_plate ?? "No plate"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveKyc(r.id)}
                    className="flex items-center gap-1 rounded-lg bg-green-500/10 text-green-400 px-3 py-1.5 text-xs font-semibold hover:bg-green-500/20"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => rejectKyc(r.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20"
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
              </tr>
            </thead>
            <tbody>
              {recentOrders?.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-mono text-xs">{o.code}</td>
                  <td className="py-3 max-w-[200px]">
                    <p className="truncate text-xs">{o.pickup_address}</p>
                    <p className="truncate text-xs text-muted-foreground">→ {o.dropoff_address}</p>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs font-medium capitalize ${STATUS_COLOR[o.status] ?? ""}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium">{fmtXOF(o.price_xof)}</td>
                  <td className="py-3 text-right text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
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
