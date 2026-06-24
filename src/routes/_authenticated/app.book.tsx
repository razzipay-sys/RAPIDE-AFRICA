import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Package, Shield, Zap, Clock, Loader2, MapPin, User, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CITIES, haversineKm, quote, fmtXOF, type DeliveryType, type GeoResult } from "@/lib/pricing";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { LiveMap, type LatLng } from "@/components/rapide/LiveMap";
import { AddressSearch } from "@/components/rapide/AddressSearch";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const Route = createFileRoute("/_authenticated/app/book")({
  component: BookPage,
});

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  if (!MAPBOX_TOKEN) return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=fr&limit=1&access_token=${MAPBOX_TOKEN}`,
    );
    const data = await res.json();
    const name: string = data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { name, lat, lng };
  } catch {
    return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  }
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.16 } }),
};

const CATEGORIES = [
  { value: "document" as const,     label: "Document" },
  { value: "food" as const,         label: "Nourriture" },
  { value: "electronics" as const,  label: "Électronique" },
  { value: "clothing" as const,     label: "Vêtement" },
  { value: "fragile" as const,      label: "Fragile" },
  { value: "other" as const,        label: "Autre" },
];

function BookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);

  // Step 1 — addresses
  const [pickup, setPickup] = useState<GeoResult>(CITIES[0]);
  const [dropoff, setDropoff] = useState<GeoResult>(CITIES[3]);
  const [lastFocused, setLastFocused] = useState<"pickup" | "dropoff">("pickup");

  // Step 2 — contacts + parcel
  const [pickupName, setPickupName]   = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [dropName, setDropName]       = useState("");
  const [dropPhone, setDropPhone]     = useState("");
  const [category, setCategory]       = useState<"document" | "food" | "electronics" | "clothing" | "fragile" | "other">("document");
  const [weight, setWeight]           = useState(2);
  const [notes, setNotes]             = useState("");

  // Step 3 — delivery type + pricing
  const [type, setType]           = useState<DeliveryType>("standard");
  const [insurance, setInsurance] = useState(false);

  const distance = useMemo(() => haversineKm(pickup, dropoff), [pickup, dropoff]);
  const q = useMemo(() => quote({ distanceKm: distance, type, insurance, weightKg: weight }), [distance, type, insurance, weight]);

  const goTo = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    setMapInteractive(false);
  };

  const handleMapClick = useCallback(async (latlng: LatLng) => {
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    if (lastFocused === "pickup") setPickup(result);
    else setDropoff(result);
  }, [lastFocused]);

  const validateStep1 = () => {
    if (!pickup.name.trim() || !dropoff.name.trim()) {
      toast.error(t("book.pickup") + " / " + t("book.dropoff") + " requis");
      return false;
    }
    if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
      toast.error("Les adresses de collecte et de livraison doivent être différentes");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!dropName.trim()) {
      toast.error("Le nom du destinataire est requis");
      return false;
    }
    if (!dropPhone.trim()) {
      toast.error("Le téléphone du destinataire est requis");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("orders").insert({
      customer_id: user.id,
      pickup_address: pickup.name, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      pickup_contact_name: pickupName || null, pickup_contact_phone: pickupPhone || null,
      dropoff_address: dropoff.name, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      dropoff_contact_name: dropName, dropoff_contact_phone: dropPhone,
      parcel_category: category, parcel_weight_kg: weight, parcel_notes: notes || null,
      delivery_type: type, insurance,
      distance_km: Number(distance.toFixed(2)),
      price_xof: q.price_xof, commission_xof: q.commission_xof,
      status: "pending",
    }).select("id").single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erreur lors de la création de la commande");
      return;
    }
    await supabase.from("order_events").insert({
      order_id: data.id, status: "pending", created_by: user.id, note: "Commande créée",
    });
    toast.success(t("book.success"));
    navigate({ to: "/app/track/$orderId", params: { orderId: data.id } });
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={() => step > 1 ? goTo(step - 1) : navigate({ to: "/app" })}
          className="glass h-9 w-9 rounded-xl flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 w-8 rounded-full transition-all duration-300 ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="w-9" />
      </header>

      <div className="relative overflow-hidden">
        {/* ── STEP 1: Addresses + Map ── */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="font-display text-2xl font-bold">{t("book.step1.title")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Choisissez les adresses de collecte et de livraison</p>
            </div>

            <AddressSearch
              label={t("book.pickup")}
              icon="A"
              value={pickup}
              onChange={setPickup}
              onFocus={() => setLastFocused("pickup")}
              placeholder={t("book.search_placeholder_pickup")}
            />
            <AddressSearch
              label={t("book.dropoff")}
              icon="B"
              value={dropoff}
              onChange={setDropoff}
              onFocus={() => setLastFocused("dropoff")}
              placeholder={t("book.search_placeholder_dropoff")}
            />

            {/* Map with interaction gate to prevent scroll-lock on mobile */}
            <div className="relative rounded-3xl overflow-hidden">
              <div style={{ pointerEvents: mapInteractive ? "auto" : "none" }}>
                <LiveMap
                  pickup={pickup}
                  dropoff={dropoff}
                  height={220}
                  zoom={12}
                  onMapClick={mapInteractive ? handleMapClick : undefined}
                />
              </div>

              {!mapInteractive ? (
                <button
                  type="button"
                  onClick={() => setMapInteractive(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
                >
                  <span className="glass-strong rounded-full px-4 py-2 text-xs font-medium flex items-center gap-2 shadow-elegant">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Appuyer pour choisir sur la carte
                  </span>
                </button>
              ) : (
                <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
                  <span className="glass rounded-full px-3 py-1 text-[10px] text-muted-foreground pointer-events-none">
                    {lastFocused === "pickup" ? "Placement : point de collecte" : "Placement : destination"}
                  </span>
                </div>
              )}

              {mapInteractive && (
                <button
                  type="button"
                  onClick={() => setMapInteractive(false)}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 glass-strong rounded-full px-5 py-2 text-xs font-semibold shadow-elegant"
                >
                  Terminé
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Distance estimée : <span className="font-semibold text-foreground">{distance.toFixed(1)} km</span>
            </p>

            <button
              onClick={() => validateStep1() && goTo(2)}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 hover:scale-[1.01] transition active:scale-[0.98]"
            >
              {t("book.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Package Details ── */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="font-display text-2xl font-bold">{t("book.step2.title")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Informations sur le destinataire et le colis</p>
            </div>

            {/* Recipient (required) */}
            <div className="glass-strong rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-semibold">Destinataire <span className="text-primary text-xs">*requis</span></p>
              </div>
              <Field
                label="Nom du destinataire"
                value={dropName}
                onChange={setDropName}
                placeholder="Ex. : Kofi Mensah"
                required
              />
              <Field
                label="Téléphone du destinataire"
                value={dropPhone}
                onChange={setDropPhone}
                placeholder="+229 01 XX XX XX"
                type="tel"
                required
              />
            </div>

            {/* Sender (optional) */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Expéditeur <span className="text-xs">(optionnel)</span></p>
              </div>
              <Field
                label="Votre nom"
                value={pickupName}
                onChange={setPickupName}
                placeholder="Ex. : Ama Diallo"
              />
              <Field
                label="Votre téléphone"
                value={pickupPhone}
                onChange={setPickupPhone}
                placeholder="+229 01 XX XX XX"
                type="tel"
              />
            </div>

            {/* Parcel category */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("book.category")}</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-xl px-3 py-2.5 text-sm border transition ${
                      category === c.value ? "border-primary bg-primary/10 text-primary" : "border-border glass"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight */}
            <div className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{t("book.weight")} : <span className="text-foreground font-semibold">{weight} kg</span></p>
              <input
                type="range"
                min={1}
                max={20}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full mt-2 accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 kg</span><span>20 kg</span>
              </div>
            </div>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("book.notes_placeholder")}
              rows={3}
              className="w-full rounded-2xl bg-input/40 border border-border p-4 text-sm outline-none focus:border-primary resize-none"
            />

            <button
          onClick={() => validateStep2() && goTo(3)}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 hover:scale-[1.01] transition active:scale-[0.98]"
            >
              {t("book.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── STEP 3: Quote & Confirmation ── */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="font-display text-2xl font-bold">{t("book.step3.title")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Choisissez votre type de livraison</p>
            </div>

            <div className="space-y-2">
              <TypeOption active={type === "standard"} onClick={() => setType("standard")} icon={Package}
                title={t("book.std.title")} desc={t("book.std.desc")} />
              <TypeOption active={type === "express"}  onClick={() => setType("express")}  icon={Zap}
                title={t("book.exp.title")} desc={t("book.exp.desc")} />
              <TypeOption active={type === "scheduled"} onClick={() => setType("scheduled")} icon={Clock}
                title={t("book.sched.title")} desc={t("book.sched.desc")} />
            </div>

            <button
              type="button"
              onClick={() => setInsurance(!insurance)}
              className={`w-full rounded-2xl p-4 flex items-center justify-between border transition ${
                insurance ? "border-primary bg-primary/10" : "border-border glass"
              }`}
            >
              <span className="flex items-center gap-3 text-sm"><Shield className="h-4 w-4 text-primary" /> {t("book.insurance")}</span>
              <span className={`h-5 w-5 rounded-full border-2 flex-shrink-0 ${insurance ? "border-primary bg-primary" : "border-muted-foreground"}`} />
            </button>

            {/* Summary */}
            <div className="glass-strong rounded-2xl p-5 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Récapitulatif</p>
              <Row label="De" value={pickup.name} truncate />
              <Row label="Vers" value={dropoff.name} truncate />
              <Row label="Destinataire" value={`${dropName} · ${dropPhone}`} />
              <Row label={t("book.distance")} value={`${distance.toFixed(1)} km`} />
              <Row label="Type" value={type} />
              {insurance && <Row label="Assurance" value="Incluse" />}
              <Row label={t("book.commission")} value={fmtXOF(q.commission_xof)} muted />
              <div className="h-px bg-border my-2" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t("book.total")}</span>
                <span className="font-display text-2xl font-bold text-gradient-primary">{fmtXOF(q.price_xof)}</span>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2 hover:scale-[1.01] transition active:scale-[0.98]"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("book.confirm")} · {fmtXOF(q.price_xof)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-input/40 border px-3 py-2.5 text-sm outline-none transition focus:border-primary ${
          required && !value.trim() ? "border-destructive/40" : "border-border"
        }`}
      />
    </div>
  );
}

function TypeOption({ active, onClick, icon: Icon, title, desc }: {
  active: boolean; onClick: () => void; icon: React.ElementType; title: string; desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl p-4 flex items-center gap-3 border transition text-left ${
        active ? "border-primary bg-primary/10" : "border-border glass"
      }`}
    >
      <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className={`h-5 w-5 rounded-full border-2 shrink-0 ${active ? "border-primary bg-primary" : "border-muted-foreground"}`} />
    </button>
  );
}

function Row({ label, value, muted, truncate }: { label: string; value: string; muted?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`${muted ? "text-muted-foreground" : "font-medium"} ${truncate ? "truncate text-right" : ""}`}>{value}</span>
    </div>
  );
}
