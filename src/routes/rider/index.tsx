import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi, WifiOff, MapPin, Star, Package, Zap, ChevronRight,
  Navigation, MessageCircle, KeyRound, CheckCircle2, Phone, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";
import { LiveMap } from "@/components/rapide/LiveMap";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export const Route = createFileRoute("/rider/")({
  component: RiderDashboard,
});

// ── OTP Delivery Dialog ────────────────────────────────────────────────────────
function OTPDeliveryDialog({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (otp: string) => void;
  pending: boolean;
}) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 3) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  };

  const code = otp.join("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="glass-strong w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold">Enter Delivery Code</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ask the customer for their 4-digit OTP to confirm handoff
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-16 w-14 rounded-2xl bg-input/50 border-2 border-border text-center text-2xl font-bold outline-none focus:border-primary transition-colors"
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl glass py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => code.length === 4 && onSubmit(code)}
            disabled={code.length !== 4 || pending}
            className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40 transition"
          >
            {pending ? "Verifying…" : "Confirm Delivery"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Status label helpers ───────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  rider_assigned: "Assigned",
  rider_arriving: "Arriving at pickup",
  picked_up: "Parcel collected",
  in_transit: "In transit",
};

const STATUS_NEXT: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  rider_assigned: { label: "En Route to Pickup", status: "rider_arriving" },
  rider_arriving: { label: "Picked Up ✓", status: "picked_up" },
  picked_up:      { label: "Start Delivery", status: "in_transit" },
};

// ── Main Component ─────────────────────────────────────────────────────────────
function RiderDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const watchRef = useRef<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "active" | "error">("idle");
  const [otpOpen, setOtpOpen] = useState(false);

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
        .select("id,code,status,pickup_address,dropoff_address,price_xof,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,dropoff_contact_name,dropoff_contact_phone,customer_id")
        .eq("rider_id", rider!.id)
        .in("status", ["rider_assigned", "rider_arriving", "picked_up", "in_transit"])
        .maybeSingle();
      return data;
    },
    enabled: !!rider,
    refetchInterval: 10000,
  });

  // Fetch chat conversation for active order
  const { data: conversation } = useQuery({
    queryKey: ["rider-chat", activeOrder?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("order_id", activeOrder!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!activeOrder?.id,
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

  // GPS watch
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
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      await supabase.from("order_events").insert({
        order_id: orderId,
        status,
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-order"] });
      toast.success("Order status updated");
    },
    onError: () => toast.error("Failed to update order"),
  });

  const completeDelivery = useMutation({
    mutationFn: async (otp: string) => {
      if (!activeOrder || !rider || !user) throw new Error("Missing data");
      const { data, error } = await (supabase.rpc as CallableFunction)(
        "complete_delivery",
        { p_order_id: activeOrder.id, p_otp: otp, p_rider_user_id: user.id }
      );
      if (error) throw error;
      if (!data) throw new Error("Invalid OTP — please try again");
      return data;
    },
    onSuccess: () => {
      setOtpOpen(false);
      qc.invalidateQueries({ queryKey: ["active-order"] });
      qc.invalidateQueries({ queryKey: ["today-stats"] });
      toast.success("Delivery confirmed! Great job 🎉");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOnline = rider?.is_online ?? false;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Rider";

  // Navigation deep link — destination depends on current status
  const navDestination = activeOrder
    ? (["in_transit"].includes(activeOrder.status)
        ? { lat: activeOrder.dropoff_lat, lng: activeOrder.dropoff_lng }
        : { lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng })
    : null;

  const googleMapsUrl = navDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${navDestination.lat},${navDestination.lng}&travelmode=motorcycle`
    : null;

  // Map markers for active order
  const pickup = activeOrder
    ? { lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng }
    : undefined;
  const dropoff = activeOrder
    ? { lat: activeOrder.dropoff_lat, lng: activeOrder.dropoff_lng }
    : undefined;

  return (
    <>
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
          className={`w-full rounded-3xl p-6 text-left transition-all duration-300 disabled:opacity-70 ${
            isOnline
              ? "bg-gradient-primary shadow-glow"
              : "glass-strong border border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {toggleOnline.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isOnline ? (
                  <Wifi className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    isOnline ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {toggleOnline.isPending ? "Updating…" : isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <p className={`font-display text-2xl font-bold ${isOnline ? "text-primary-foreground" : ""}`}>
                {isOnline ? "You're available" : "You're unavailable"}
              </p>
              <p className={`text-sm mt-0.5 ${isOnline ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {isOnline ? "Accepting dispatch orders now" : "Tap to start receiving orders"}
              </p>
            </div>
            {/* iOS-style toggle switch */}
            <div
              className={`relative h-8 w-14 rounded-full transition-colors duration-300 ${
                isOnline ? "bg-white/30" : "bg-muted-foreground/20"
              }`}
            >
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className={`absolute top-1 h-6 w-6 rounded-full shadow-lg ${
                  isOnline ? "bg-white left-7" : "bg-muted-foreground/60 left-1"
                }`}
              />
            </div>
          </div>
        </motion.button>

        {/* Mini GPS Map — shown when online, no active order */}
        {isOnline && !activeOrder && rider?.current_lat && rider?.current_lng && (
          <LiveMap
            rider={{ lat: Number(rider.current_lat), lng: Number(rider.current_lng) }}
            showGeolocate
            height={180}
            zoom={15}
          />
        )}

        {/* Active Order Card */}
        <AnimatePresence>
          {activeOrder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-strong rounded-3xl overflow-hidden border border-primary/30"
            >
              {/* Map preview */}
              <LiveMap
                pickup={pickup}
                dropoff={dropoff}
                rider={
                  rider?.current_lat && rider?.current_lng
                    ? { lat: Number(rider.current_lat), lng: Number(rider.current_lng) }
                    : undefined
                }
                showRoute
                routeCoords={
                  rider?.current_lat && rider?.current_lng && activeOrder
                    ? [
                        { lat: Number(rider.current_lat), lng: Number(rider.current_lng) },
                        ["in_transit", "picked_up"].includes(activeOrder.status) ? dropoff! : pickup!
                      ]
                    : undefined
                }
                height={180}
                zoom={13}
              />

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Active Delivery
                    </span>
                  </div>
                  <span className="text-xs glass rounded-full px-2.5 py-1">
                    {STATUS_LABELS[activeOrder.status] ?? activeOrder.status.replace(/_/g, " ")}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground font-mono mb-1">#{activeOrder.code}</p>
                <div className="flex items-start gap-2 mb-4">
                  <div className="flex flex-col items-center mt-1 shrink-0">
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                    <div className="w-px h-5 bg-border" />
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{activeOrder.pickup_address}</p>
                    <p className="text-xs text-muted-foreground mt-4">{activeOrder.dropoff_address}</p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{fmtXOF(activeOrder.price_xof)}</p>
                </div>

                {/* Action buttons row */}
                <div className="flex gap-2 mb-3">
                  {/* Navigation */}
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl glass py-2.5 px-3 text-xs font-semibold flex-1"
                    >
                      <Navigation className="h-3.5 w-3.5 text-blue-400" />
                      Navigate
                    </a>
                  )}

                  {/* Chat with customer */}
                  {conversation ? (
                    <Link
                      to="/app/chat/$cid"
                      params={{ cid: conversation.id }}
                      className="flex items-center justify-center gap-1.5 rounded-xl glass py-2.5 px-3 text-xs font-semibold flex-1"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-green-400" />
                      Message
                    </Link>
                  ) : (
                    activeOrder.dropoff_contact_phone && (
                      <a
                        href={`tel:${activeOrder.dropoff_contact_phone}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl glass py-2.5 px-3 text-xs font-semibold flex-1"
                      >
                        <Phone className="h-3.5 w-3.5 text-green-400" />
                        Call
                      </a>
                    )
                  )}
                </div>

                {/* Main status action */}
                <div className="flex gap-2">
                  {(() => {
                    const next = STATUS_NEXT[activeOrder.status as OrderStatus];
                    return next ? (
                      <button
                        onClick={() =>
                          updateOrderStatus.mutate({ orderId: activeOrder.id, status: next.status })
                        }
                        disabled={updateOrderStatus.isPending}
                        className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
                      >
                        {updateOrderStatus.isPending ? "Updating…" : next.label}
                      </button>
                    ) : null;
                  })()}

                  {activeOrder.status === "in_transit" && (
                    <button
                      onClick={() => setOtpOpen(true)}
                      className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Delivery
                    </button>
                  )}
                </div>
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

      {/* OTP Dialog */}
      <AnimatePresence>
        {otpOpen && (
          <OTPDeliveryDialog
            open={otpOpen}
            onClose={() => setOtpOpen(false)}
            onSubmit={(otp) => completeDelivery.mutate(otp)}
            pending={completeDelivery.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}
