import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, MapPin, Star, Package, Zap, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";
import { LiveMap } from "@/components/rapide/LiveMap";

export const Route = createFileRoute("/rider/")({
  component: RiderDashboard,
});

function RiderDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const watchRef = useRef<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "active" | "error">("idle");

  const { data: rider } = useQuery({
    queryKey: ["rider-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_xof")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: activeOrder } = useQuery({
    queryKey: ["active-order", rider?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, status, pickup_address, dropoff_address, price_xof, dropoff_contact_name, dropoff_contact_phone")
        .eq("rider_id", rider!.id)
        .in("status", ["rider_assigned", "rider_arriving", "picked_up", "in_transit"])
        .maybeSingle();
      return data;
    },
    enabled: !!rider,
    refetchInterval: 10000,
  });

  const { data: todayStats } = useQuery({
    queryKey: ["today-stats", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("wallet_transactions")
        .select("amount_xof, type")
        .eq("user_id", user!.id)
        .gte("created_at", today.toISOString())
        .in("type", ["payout", "bonus", "commission"]);
      const earned = data?.reduce((s, t) => s + Number(t.amount_xof), 0) ?? 0;
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("rider_id", rider!.id)
        .eq("status", "delivered")
        .gte("delivered_at", today.toISOString());
      return { earned, deliveries: orders?.length ?? 0 };
    },
    enabled: !!user && !!rider,
    refetchInterval: 30000,
  });

  // GPS watch — pings Supabase every position update while online
  const pingGPS = async (lat: number, lng: number) => {
    if (!rider) return;
    await supabase
      .from("riders")
      .update({ current_lat: lat, current_lng: lng, last_seen_at: new Date().toISOString() })
      .eq("id", rider.id);
  };

  useEffect(() => {
    if (!rider?.is_online) {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        setGpsStatus("idle");
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("active");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        pingGPS(pos.coords.latitude, pos.coords.longitude);
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [rider?.is_online, rider?.id]);

  const toggleOnline = useMutation({
    mutationFn: async () => {
      if (!rider) return;
      const next = !rider.is_online;
      const { error } = await supabase
        .from("riders")
        .update({ is_online: next, last_seen_at: new Date().toISOString() })
        .eq("id", rider.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["rider-profile"] });
      toast.success(next ? "You're now online — accepting orders" : "You're offline");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      await supabase.from("order_events").insert({
        order_id: orderId,
        status: status as never,
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-order"] });
      toast.success("Order status updated");
    },
  });

  const isOnline = rider?.is_online ?? false;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Rider";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-2xl font-bold">{firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {gpsStatus === "active" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <MapPin className="h-3 w-3" /> GPS live
            </span>
          )}
          {gpsStatus === "error" && (
            <span className="text-xs text-destructive">GPS error</span>
          )}
          <div className="flex items-center gap-1 glass rounded-full px-3 py-1">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-bold">{Number(rider?.rating ?? 5).toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Online/Offline Toggle */}
      <motion.button
        onClick={() => toggleOnline.mutate()}
        disabled={toggleOnline.isPending || !rider}
        whileTap={{ scale: 0.97 }}
        className={`w-full rounded-3xl p-6 text-left transition-all ${
          isOnline
            ? "bg-gradient-primary shadow-glow"
            : "glass-strong border border-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-primary-foreground" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isOnline ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <p
              className={`font-display text-2xl font-bold ${
                isOnline ? "text-primary-foreground" : ""
              }`}
            >
              {isOnline ? "Tap to go offline" : "Tap to go online"}
            </p>
            <p
              className={`text-sm mt-0.5 ${
                isOnline ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {isOnline ? "Accepting dispatch orders now" : "You won't receive new orders"}
            </p>
          </div>
          <div
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${
              isOnline ? "bg-white/20" : "bg-muted"
            }`}
          >
            <div
              className={`h-8 w-8 rounded-full transition-all ${
                isOnline ? "bg-white shadow-lg" : "bg-muted-foreground/30"
              }`}
            />
          </div>
        </div>
      </motion.button>

      {/* Mini GPS Map — shown when online and location known */}
      {isOnline && rider?.current_lat && rider?.current_lng && (
        <LiveMap
          rider={{ lat: Number(rider.current_lat), lng: Number(rider.current_lng) }}
          showGeolocate
          height={180}
          zoom={15}
        />
      )}

      {/* Active Order */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-strong rounded-3xl p-5 border border-primary/30"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Active Delivery
                </span>
              </div>
              <span className="text-xs glass rounded-full px-2.5 py-1 capitalize">
                {activeOrder.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-0.5">#{activeOrder.code}</p>
            <p className="font-medium text-sm mb-3">
              {activeOrder.pickup_address} → {activeOrder.dropoff_address}
            </p>
            <div className="flex gap-2">
              {activeOrder.status === "rider_assigned" && (
                <button
                  onClick={() =>
                    updateOrderStatus.mutate({ orderId: activeOrder.id, status: "rider_arriving" })
                  }
                  className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  En Route to Pickup
                </button>
              )}
              {activeOrder.status === "rider_arriving" && (
                <button
                  onClick={() =>
                    updateOrderStatus.mutate({ orderId: activeOrder.id, status: "picked_up" })
                  }
                  className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Picked Up ✓
                </button>
              )}
              {activeOrder.status === "picked_up" && (
                <button
                  onClick={() =>
                    updateOrderStatus.mutate({ orderId: activeOrder.id, status: "in_transit" })
                  }
                  className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  In Transit
                </button>
              )}
              {activeOrder.status === "in_transit" && (
                <button
                  onClick={() =>
                    updateOrderStatus.mutate({ orderId: activeOrder.id, status: "delivered" })
                  }
                  className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Mark Delivered ✓
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Earnings</p>
          <p className="mt-1 font-display text-2xl font-bold text-gradient-primary">
            {fmtXOF(todayStats?.earned ?? 0)}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Deliveries</p>
          <p className="mt-1 font-display text-2xl font-bold">{todayStats?.deliveries ?? 0}</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="glass-strong rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Wallet balance</p>
          <p className="font-display text-xl font-bold">{fmtXOF(wallet?.balance_xof ?? 0)}</p>
        </div>
        <Link to="/rider/earnings" className="flex items-center gap-1 text-primary text-sm font-medium">
          View <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Dispatch CTA */}
      {isOnline && !activeOrder && (
        <Link
          to="/rider/dispatch"
          className="block rounded-2xl glass border border-border p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Dispatch Queue</p>
              <p className="text-xs text-muted-foreground">Accept new orders</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
