import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Circle,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Shield,
  Star,
  Clock,
  Navigation,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF, haversineKm } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { LiveMap, MapSkeleton } from "@/components/rapide/LiveMapLazy";
import { RatingModal } from "@/components/rapide/RatingModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/track/$orderId")({
  component: TrackPage,
});

const ORDER_STATUS_MAP: Record<string, number> = {
  pending: 0,
  searching_rider: 0,
  rider_assigned: 1,
  rider_arriving: 2,
  picked_up: 3,
  in_transit: 4,
  delivered: 5,
};

function TrackPage() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const STATUS_FLOW = [
    { label: t("track.s.pending"), icon: Clock },
    { label: t("track.s.accepted"), icon: Bike },
    { label: t("track.s.arriving"), icon: Navigation },
    { label: t("track.s.picked_up"), icon: MapPin },
    { label: t("track.s.in_transit"), icon: Bike },
    { label: t("track.s.delivered"), icon: CheckCircle2 },
  ];

  // ── Core order data ────────────────────────────────────────────────────────
  const { data: order, isLoading } = useQuery({
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

  // ── Rider location (live) ──────────────────────────────────────────────────
  const { data: riderLoc } = useQuery({
    queryKey: ["rider-location", order?.rider_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select("current_lat, current_lng, rating, vehicle_type, user_id")
        .eq("id", order!.rider_id!)
        .single();
      return data;
    },
    enabled: !!order?.rider_id,
    refetchInterval: 6000,
  });

  // ── Rider profile (name) ───────────────────────────────────────────────────
  const { data: riderProfile } = useQuery({
    queryKey: ["rider-profile-name", riderLoc?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", riderLoc!.user_id)
        .single();
      return data;
    },
    enabled: !!riderLoc?.user_id,
  });

  // ── Conversation link ──────────────────────────────────────────────────────
  const { data: convoId } = useQuery({
    queryKey: ["order-convo", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!order?.rider_id,
  });

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`track-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["order", orderId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_events",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["order-events", orderId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  useEffect(() => {
    if (!order?.rider_id) return;
    const ch = supabase
      .channel(`rider-pos-${order.rider_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "riders", filter: `id=eq.${order.rider_id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["rider-location", order.rider_id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [order?.rider_id, qc]);

  // ── Show rating prompt when delivered ─────────────────────────────────────
  useEffect(() => {
    if (order?.status === "delivered" && !order.customer_rating && !ratingDone) {
      const timer = setTimeout(() => setRatingOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [order?.status, order?.customer_rating, ratingDone]);

  // ── Rating mutation ────────────────────────────────────────────────────────
  const submitRating = useMutation({
    mutationFn: async ({ rating }: { rating: number }) => {
      const { error } = await supabase
        .from("orders")
        .update({ customer_rating: rating })
        .eq("id", orderId)
        .eq("customer_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRatingOpen(false);
      setRatingDone(true);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success(t("rating.thanks"));
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentIdx = order?.status ? (ORDER_STATUS_MAP[order.status] ?? 0) : 0;
  const pct = ((currentIdx + 1) / STATUS_FLOW.length) * 100;

  // Memoized on the primitive lat/lng values (not object identity) so LiveMap's
  // internal effects — which depend on these by reference — don't re-fire
  // (and re-animate map.fitBounds) on every unrelated parent re-render.
  const pickup = useMemo(
    () =>
      order?.pickup_lat ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) } : null,
    [order?.pickup_lat, order?.pickup_lng],
  );
  const dropoff = useMemo(
    () =>
      order?.dropoff_lat
        ? { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) }
        : null,
    [order?.dropoff_lat, order?.dropoff_lng],
  );
  const rider = useMemo(
    () =>
      riderLoc?.current_lat
        ? { lat: Number(riderLoc.current_lat), lng: Number(riderLoc.current_lng) }
        : null,
    [riderLoc?.current_lat, riderLoc?.current_lng],
  );

  // ETA: distance from rider to next relevant point / 20 km/h
  const eta = useMemo(() => {
    if (!rider || !order) return null;
    const dest = ["in_transit", "picked_up"].includes(order.status) ? dropoff : pickup;
    if (!dest) return null;
    const km = haversineKm(rider, dest);
    return Math.max(1, Math.round((km / 20) * 60));
  }, [rider, order?.status, pickup, dropoff]);

  const routeCoords = useMemo(() => {
    if (!rider || !order) return undefined;
    const dest = ["in_transit", "picked_up"].includes(order.status) ? dropoff : pickup;
    return dest ? [rider, dest] : undefined;
  }, [rider, order?.status, pickup, dropoff]);

  // ── Share tracking ─────────────────────────────────────────────────────────
  const shareTracking = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `Rapide · ${order?.code}`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(t("app.copied"));
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-9 rounded-xl bg-muted" />
        <div className="h-64 rounded-3xl bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-40 rounded-2xl bg-muted" />
      </div>
    );
  }

  const isSearching = !order?.rider_id;
  const isActive = ["rider_assigned", "rider_arriving", "picked_up", "in_transit"].includes(
    order?.status ?? "",
  );
  const isDelivered = order?.status === "delivered";
  const showOtp = order?.status === "in_transit" && order.delivery_otp;
  const riderName = riderProfile?.full_name ?? (t("track.rider") || "Rider");
  const vehicleLabel = riderLoc?.vehicle_type ?? "motorbike";

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="glass h-9 w-9 rounded-xl flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-sm font-semibold">{order?.code ?? "…"}</p>
        <button
          onClick={shareTracking}
          className="glass h-9 w-9 rounded-xl flex items-center justify-center"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      {/* Map */}
      <Suspense fallback={<MapSkeleton height={isActive ? 280 : 220} />}>
        <LiveMap
          pickup={pickup}
          dropoff={dropoff}
          rider={rider}
          showRoute
          routeCoords={routeCoords}
          height={isActive ? 280 : 220}
          zoom={isActive && rider ? 14 : 12}
        />
      </Suspense>

      {/* Searching animation */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-5"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 shrink-0">
              <motion.div
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-primary/30"
              />
              <div className="relative h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Bike className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-display font-bold">{t("track.searching")}</p>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rider card */}
      {order?.rider_id && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-13 w-13 rounded-full bg-gradient-primary flex items-center justify-center font-display text-lg font-bold text-primary-foreground h-[52px] w-[52px]">
                {riderName[0]?.toUpperCase() ?? "R"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-400 border-2 border-background" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{riderName}</p>
                <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-medium">
                    {Number(riderLoc?.rating ?? 4.9).toFixed(1)}
                  </span>
                </div>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground capitalize">{vehicleLabel}</span>
              </div>
              {/* ETA */}
              {eta && isActive && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {t("track.eta_val")?.replace("{eta}", eta.toString()) ?? `~${eta} min`}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {convoId && (
                <Link
                  to="/app/chat/$cid"
                  params={{ cid: convoId }}
                  className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center"
                >
                  <MessageCircle className="h-4 w-4" />
                </Link>
              )}
              <button className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* OTP display */}
      <AnimatePresence>
        {showOtp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-strong rounded-2xl p-5 border border-primary/30"
          >
            <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider">
              {t("track.otp_code")}
            </p>
            <div className="flex gap-3 justify-center">
              {order!.delivery_otp!.split("").map((digit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="h-14 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center"
                >
                  <span className="font-display text-2xl font-bold text-primary">{digit}</span>
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">{t("track.otp_desc")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivered celebration */}
      {isDelivered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-primary p-5 shadow-glow text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.6, times: [0, 0.5, 1] }}
            className="text-4xl mb-2"
          >
            🎉
          </motion.div>
          <p className="font-display text-xl font-bold text-primary-foreground">
            {t("track.delivered_title")}
          </p>
          <p className="text-sm text-primary-foreground/70 mt-1">
            {order?.delivered_at
              ? new Date(order.delivered_at).toLocaleTimeString(t("auto.engb"), {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
          {!order?.customer_rating && !ratingDone && (
            <button
              onClick={() => setRatingOpen(true)}
              className="mt-4 glass rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground/90 hover:bg-white/15 transition"
            >
              ★ {t("rating.title")}
            </button>
          )}
          {(order?.customer_rating || ratingDone) && (
            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-5 w-5 ${s <= (order?.customer_rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Progress bar + status */}
      {!isDelivered && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-sm font-bold">{STATUS_FLOW[currentIdx]?.label}</p>
            {eta && isActive && <p className="text-xs text-primary font-medium">~{eta} min</p>}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-primary rounded-full"
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <section className="glass rounded-2xl p-4">
        <h2 className="font-display text-sm font-semibold mb-4">{t("track.live")}</h2>
        <ol className="space-y-3">
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const Icon = s.icon;
            const eventForStep = events?.find((e) => ORDER_STATUS_MAP[e.status] === i);
            return (
              <li key={i} className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? "bg-primary/15" : "bg-muted/50"
                  }`}
                >
                  {done ? (
                    <Icon className={`h-4 w-4 text-primary ${isCurrent ? "animate-pulse" : ""}`} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${done ? "text-foreground" : "text-muted-foreground/50"} ${isCurrent ? "font-semibold" : ""}`}
                  >
                    {s.label}
                  </p>
                  {eventForStep && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(eventForStep.created_at).toLocaleTimeString(t("auto.engb"), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                {isCurrent && !isDelivered && (
                  <span className="text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0">
                    {t("app.now")}
                  </span>
                )}
                {done && !isCurrent && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Order details */}
      {order && (
        <div className="glass-strong rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t("map.pickup")}
              </p>
              <p className="text-sm">{order.pickup_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t("map.dropoff")}
              </p>
              <p className="text-sm">{order.dropoff_address}</p>
            </div>
          </div>

          {order.distance_km && (
            <div className="flex gap-4 pt-1">
              <div className="flex-1 text-center glass rounded-xl p-2.5">
                <p className="text-xs text-muted-foreground">{t("book.distance")}</p>
                <p className="font-semibold text-sm">{Number(order.distance_km).toFixed(1)} km</p>
              </div>
              <div className="flex-1 text-center glass rounded-xl p-2.5">
                <p className="text-xs text-muted-foreground capitalize">{order.delivery_type}</p>
                <p className="font-semibold text-sm capitalize">{order.parcel_category}</p>
              </div>
              {order.insurance && (
                <div className="flex-1 text-center glass rounded-xl p-2.5">
                  <p className="text-xs text-muted-foreground">{t("track.insurance")}</p>
                  <Shield className="h-4 w-4 text-green-400 mx-auto mt-0.5" />
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t("track.amount")}</span>
            <span className="font-display text-2xl font-bold text-gradient-primary">
              {fmtXOF(order.price_xof)}
            </span>
          </div>
        </div>
      )}

      {/* Rating modal */}
      <RatingModal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        onSubmit={(rating) => submitRating.mutate({ rating })}
        pending={submitRating.isPending}
      />
    </div>
  );
}
