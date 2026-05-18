import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, MapPin, Clock, ChevronRight, X, Check, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/rider/dispatch")({
  component: RiderDispatch,
});

type Order = Tables<"orders">;

function RiderDispatch() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [newOrder, setNewOrder] = useState<Order | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  const { data: rider } = useQuery({
    queryKey: ["rider-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("riders").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Available orders — searching_rider, no rider yet
  const { data: orders, isLoading } = useQuery({
    queryKey: ["dispatch-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "searching_rider")
        .is("rider_id", null)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!rider,
    refetchInterval: 15000,
  });

  // Realtime subscription for new incoming orders
  useEffect(() => {
    if (!rider?.is_online) return;
    channelRef.current = supabase
      .channel("dispatch-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: "status=eq.searching_rider" },
        (payload) => {
          const order = payload.new as Order;
          setNewOrder(order);
          qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
        },
      )
      .subscribe();
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [rider?.is_online, qc]);

  const acceptOrder = useMutation({
    mutationFn: async (orderId: string) => {
      if (!rider) throw new Error("No rider profile");
      // Optimistic claim — use rpc to avoid race conditions in production
      const { error } = await supabase
        .from("orders")
        .update({ rider_id: rider.id, status: "rider_assigned" })
        .eq("id", orderId)
        .eq("status", "searching_rider")
        .is("rider_id", null);
      if (error) throw error;
      await supabase.from("order_events").insert({
        order_id: orderId,
        status: "rider_assigned",
        created_by: user?.id,
      });
    },
    onMutate: (id) => setAccepting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      qc.invalidateQueries({ queryKey: ["active-order"] });
      setNewOrder(null);
      setAccepting(null);
      toast.success("Order accepted! Head to pickup.");
    },
    onError: (e) => {
      setAccepting(null);
      toast.error("Could not accept order — it may already be taken.");
    },
  });

  if (!rider?.is_online) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="h-16 w-16 rounded-full glass flex items-center justify-center">
          <Wifi className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl font-bold">You're Offline</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Go online from the dashboard to start receiving dispatch orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dispatch Queue</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${orders?.length ?? 0} available orders`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-green-400">Live</span>
        </div>
      </div>

      {/* Incoming order alert */}
      <AnimatePresence>
        {newOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-3xl bg-gradient-primary p-5 shadow-glow"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              <span className="text-xs font-bold text-primary-foreground/80 uppercase tracking-wider">
                New Order Incoming!
              </span>
            </div>
            <p className="font-display text-lg font-bold text-primary-foreground mb-1">
              {newOrder.pickup_address}
            </p>
            <p className="text-sm text-primary-foreground/80 mb-3">
              → {newOrder.dropoff_address}
            </p>
            <p className="font-display text-2xl font-bold text-primary-foreground mb-4">
              {fmtXOF(newOrder.price_xof)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => acceptOrder.mutate(newOrder.id)}
                disabled={accepting === newOrder.id}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-primary"
              >
                <Check className="h-4 w-4" />
                Accept
              </button>
              <button
                onClick={() => setNewOrder(null)}
                className="flex items-center justify-center rounded-xl bg-white/20 px-4 py-3"
              >
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : orders?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-display text-lg font-semibold">Queue is empty</p>
          <p className="text-sm text-muted-foreground">New orders will appear here in real-time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders?.map((order) => (
            <DispatchCard
              key={order.id}
              order={order}
              onAccept={() => acceptOrder.mutate(order.id)}
              isAccepting={accepting === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DispatchCard({
  order,
  onAccept,
  isAccepting,
}: {
  order: Order;
  onAccept: () => void;
  isAccepting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const ago = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <motion.div
      layout
      className="glass-strong rounded-2xl overflow-hidden border border-border"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs glass rounded-full px-2 py-0.5 font-mono">{order.code}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {ago}m ago
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-medium truncate">{order.pickup_address}</p>
            </div>
            <div className="flex items-start gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground truncate">{order.dropoff_address}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-lg font-bold">{fmtXOF(order.price_xof)}</p>
            {order.distance_km && (
              <p className="text-xs text-muted-foreground">{order.distance_km.toFixed(1)} km</p>
            )}
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground ml-auto mt-1 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{order.parcel_category}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{order.delivery_type.replace("_", " ")}</p>
                </div>
                {order.parcel_weight_kg && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Weight</p>
                    <p className="font-medium">{order.parcel_weight_kg} kg</p>
                  </div>
                )}
                {order.insurance && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Insurance</p>
                    <p className="font-medium text-green-400">Yes</p>
                  </div>
                )}
              </div>
              {order.parcel_notes && (
                <div className="glass rounded-xl p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p>{order.parcel_notes}</p>
                </div>
              )}
              <button
                onClick={onAccept}
                disabled={isAccepting}
                className="w-full rounded-xl bg-gradient-primary py-3 font-bold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {isAccepting ? "Accepting..." : "Accept This Order"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
