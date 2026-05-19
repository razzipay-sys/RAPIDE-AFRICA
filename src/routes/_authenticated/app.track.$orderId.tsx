import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Bike, CheckCircle2, Circle, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { LiveMap } from "@/components/rapide/LiveMap";

export const Route = createFileRoute("/_authenticated/app/track/$orderId")({
  component: TrackPage,
});

const STATUS_KEYS = ["pending", "accepted", "arriving", "picked_up", "in_transit", "delivered"] as const;
type StatusKey = typeof STATUS_KEYS[number];

const ORDER_STATUS_MAP: Record<string, StatusKey> = {
  pending: "pending",
  searching_rider: "pending",
  rider_assigned: "accepted",
  rider_arriving: "arriving",
  picked_up: "picked_up",
  in_transit: "in_transit",
  delivered: "delivered",
};

function TrackPage() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const { t, lang } = useT();

  const STATUS_FLOW: { key: StatusKey; label: string }[] = [
    { key: "pending", label: t("track.s.pending") },
    { key: "accepted", label: t("track.s.accepted") },
    { key: "arriving", label: t("track.s.arriving") },
    { key: "picked_up", label: t("track.s.picked_up") },
    { key: "in_transit", label: t("track.s.in_transit") },
    { key: "delivered", label: t("track.s.delivered") },
  ];

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["order-events", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: riderLoc } = useQuery({
    queryKey: ["rider-location", order?.rider_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select("current_lat, current_lng, rating")
        .eq("id", order!.rider_id!)
        .single();
      return data;
    },
    enabled: !!order?.rider_id,
    refetchInterval: 8000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => {
        qc.invalidateQueries({ queryKey: ["order", orderId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${orderId}` }, () => {
        qc.invalidateQueries({ queryKey: ["order-events", orderId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, qc]);

  useEffect(() => {
    if (!order?.rider_id) return;
    const ch = supabase
      .channel(`rider-loc-${order.rider_id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "riders", filter: `id=eq.${order.rider_id}` }, () => {
        qc.invalidateQueries({ queryKey: ["rider-location", order.rider_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order?.rider_id, qc]);

  const mappedStatus = order?.status ? (ORDER_STATUS_MAP[order.status] ?? "pending") : "pending";
  const currentIdx = Math.max(0, STATUS_FLOW.findIndex((s) => s.key === mappedStatus));
  const pct = ((currentIdx + 1) / STATUS_FLOW.length) * 100;

  const hasCoords = order?.pickup_lat && order?.pickup_lng && order?.dropoff_lat && order?.dropoff_lng;

  const pickup = hasCoords ? { lat: Number(order!.pickup_lat), lng: Number(order!.pickup_lng) } : null;
  const dropoff = hasCoords ? { lat: Number(order!.dropoff_lat), lng: Number(order!.dropoff_lng) } : null;
  const rider = riderLoc?.current_lat && riderLoc?.current_lng
    ? { lat: Number(riderLoc.current_lat), lng: Number(riderLoc.current_lng) }
    : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Link to="/app" className="glass h-9 w-9 rounded-xl flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="font-display text-sm font-semibold">{order?.code ?? "..."}</p>
        <div className="w-9" />
      </header>

      {/* Live Map */}
      {hasCoords ? (
        <LiveMap pickup={pickup} dropoff={dropoff} rider={rider} showRoute height={260} />
      ) : (
        /* Fallback animated bar */
        <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial opacity-50 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between text-xs gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{order?.pickup_address}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 text-right">
                <span className="truncate">{order?.dropoff_address}</span>
                <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
              </div>
            </div>
            <div className="relative mt-5 h-1.5 rounded-full bg-muted overflow-visible">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-primary rounded-full"
              />
              <motion.div
                animate={{ left: `${pct}%` }}
                transition={{ duration: 0.8 }}
                style={{ position: "absolute", top: "-10px" }}
                className="h-6 w-6 -translate-x-1/2 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center"
              >
                <Bike className="h-3.5 w-3.5 text-primary-foreground" />
              </motion.div>
            </div>
            <p className="mt-6 text-center font-display text-xl font-bold">{STATUS_FLOW[currentIdx]?.label}</p>
          </div>
        </div>
      )}

      {/* Status pill shown below map */}
      {hasCoords && (
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Bike className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-base">{STATUS_FLOW[currentIdx]?.label}</p>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rider card */}
      {order?.rider_id ? (
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
            <Bike className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("track.rider_on_way")}</p>
            <p className="text-xs text-muted-foreground">
              ★ {Number(riderLoc?.rating ?? 4.9).toFixed(1)} · Motorbike
            </p>
          </div>
          <button className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Phone className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground text-center">
          {t("track.searching")}
        </div>
      )}

      {/* Timeline */}
      <section className="glass rounded-2xl p-4">
        <h2 className="font-display text-sm font-semibold mb-3">{t("track.live")}</h2>
        <ol className="space-y-3">
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <li key={s.key} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className={`h-5 w-5 text-primary ${isCurrent ? "animate-pulse" : ""}`} />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"} ${isCurrent ? "font-semibold" : ""}`}>
                  {s.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-[10px] text-primary font-medium uppercase tracking-wider">
                    {lang === "fr" ? "En cours" : "Now"}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {events && events.length > 0 && (
          <ul className="mt-4 pt-4 border-t border-border space-y-1.5">
            {events.slice(-5).reverse().map((e) => (
              <li key={e.id} className="text-xs text-muted-foreground flex justify-between">
                <span>{e.note ?? e.status}</span>
                <span>
                  {new Date(e.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Summary */}
      {order && (
        <div className="glass-strong rounded-2xl p-5 space-y-2.5">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{order.pickup_address}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{order.dropoff_address}</span>
          </div>
          <div className="border-t border-border pt-2.5 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t("track.amount")}</span>
            <span className="font-display text-2xl font-bold text-gradient-primary">{fmtXOF(order.price_xof)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
