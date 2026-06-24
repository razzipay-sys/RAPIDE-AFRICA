import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MapIcon, Users, CheckCircle, Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LiveMap } from "@/components/rapide/LiveMap";

export const Route = createFileRoute("/dispatcher/")({
  component: DispatcherDashboard,
});

function DispatcherDashboard() {
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["dispatcher-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, 
          status, price_xof, created_at, delivery_type,
          profiles:user_id (full_name, phone)
        `)
        .eq("status", "searching_rider")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const { data: riders, isLoading: loadingRiders } = useQuery({
    queryKey: ["dispatcher-riders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select(`
          id, current_lat, current_lng, is_online,
          profiles!riders_id_fkey (full_name, phone)
        `)
        .eq("is_online", true);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const assignRider = useMutation({
    mutationFn: async ({ orderId, riderId }: { orderId: string; riderId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({
          rider_id: riderId,
          status: "rider_assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order assigned to rider successfully!");
      setSelectedOrder(null);
      qc.invalidateQueries({ queryKey: ["dispatcher-orders"] });
      qc.invalidateQueries({ queryKey: ["dispatcher-riders"] });
    },
    onError: () => toast.error("Failed to assign order"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dispatch Center</h1>
        <p className="text-sm text-muted-foreground">
          {orders?.length ?? 0} unassigned orders · {riders?.length ?? 0} active riders
        </p>
      </div>

      {/* Live Map Overview */}
      <div className="relative rounded-3xl overflow-hidden glass h-64 border border-white/10">
        <LiveMap 
          riders={riders?.map(r => ({ lat: Number(r.current_lat), lng: Number(r.current_lng), id: r.id }))}
          pickup={selectedOrder ? { lat: Number(selectedOrder.pickup_lat), lng: Number(selectedOrder.pickup_lng) } : undefined}
          dropoff={selectedOrder ? { lat: Number(selectedOrder.dropoff_lat), lng: Number(selectedOrder.dropoff_lng) } : undefined}
          showRoute={!!selectedOrder}
        />
        <div className="absolute top-4 left-4 z-10">
          <div className="glass-strong rounded-2xl px-3 py-1.5 text-xs font-semibold shadow-elegant">
            Live Overview
          </div>
        </div>
      </div>

      {/* Unassigned Orders */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Unassigned Orders
        </h2>
        
        {loadingOrders ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="glass h-20 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !orders?.length ? (
          <div className="glass rounded-2xl py-8 text-center border-dashed">
            <CheckCircle className="h-8 w-8 text-green-400/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All clear. No pending orders.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o: any) => (
              <motion.div
                key={o.id}
                layout
                className={`rounded-2xl p-4 transition-all cursor-pointer border ${
                  selectedOrder?.id === o.id
                    ? "glass-strong border-primary shadow-glow"
                    : "glass border-transparent hover:bg-white/5"
                }`}
                onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                      {o.delivery_type}
                    </span>
                    <p className="font-semibold text-sm mt-1">{o.profiles?.full_name ?? "Unknown Customer"}</p>
                    <p className="text-[10px] text-muted-foreground">{o.profiles?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{o.price_xof} XOF</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedOrder?.id === o.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/10 mt-3 pt-3"
                    >
                      <h3 className="text-xs font-semibold mb-2">Available Active Riders</h3>
                      {!riders?.length ? (
                        <p className="text-xs text-muted-foreground">No active riders online.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {riders.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between bg-black/20 rounded-xl p-2">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                                  <Users className="h-3 w-3 text-primary" />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold">{r.profiles?.full_name}</p>
                                  <p className="text-[9px] text-muted-foreground">{r.profiles?.phone}</p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignRider.mutate({ orderId: o.id, riderId: r.id });
                                }}
                                disabled={assignRider.isPending}
                                className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-lg transition active:scale-95 disabled:opacity-50"
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
