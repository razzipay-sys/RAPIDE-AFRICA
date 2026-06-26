import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback, lazy, Suspense } from "react";
import { ArrowLeft, ArrowRight, Package, Shield, Zap, Clock, Loader2, MapPin, User, Phone, CheckCircle2, Map as MapIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CITIES, haversineKm, quote, fmtXOF, type DeliveryType, type GeoResult } from "@/lib/pricing";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { AddressSearch } from "@/components/rapide/AddressSearch";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

import { LiveMap } from "@/components/rapide/LiveMap";

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

const CATEGORIES = [
  { value: "document" as const,     label: "Document",    icon: "📄" },
  { value: "food" as const,         label: "Nourriture",  icon: "🍔" },
  { value: "electronics" as const,  label: "Électronique",icon: "💻" },
  { value: "clothing" as const,     label: "Vêtement",    icon: "👕" },
  { value: "fragile" as const,      label: "Fragile",     icon: "🍷" },
  { value: "other" as const,        label: "Autre",       icon: "📦" },
];

function BookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Address State
  const [pickup, setPickup] = useState<GeoResult>(CITIES[0]);
  const [dropoff, setDropoff] = useState<GeoResult>(CITIES[3]);
  const [lastFocused, setLastFocused] = useState<"pickup" | "dropoff">("pickup");

  // Detail State
  const [pickupName, setPickupName]   = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [dropName, setDropName]       = useState("");
  const [dropPhone, setDropPhone]     = useState("");
  const [category, setCategory]       = useState<typeof CATEGORIES[number]["value"]>("document");
  const [weight, setWeight]           = useState(2);
  const [notes, setNotes]             = useState("");

  // Delivery Options
  const [type, setType]           = useState<DeliveryType>("standard");
  const [insurance, setInsurance] = useState(false);

  // Memoized Calculations
  const distance = useMemo(() => haversineKm(pickup, dropoff), [pickup, dropoff]);
  const pricing = useMemo(() => quote({ distanceKm: distance, type, insurance, weightKg: weight }), [distance, type, insurance, weight]);

  const handleMapClick = useCallback(async (latlng: { lat: number; lng: number }) => {
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    if (lastFocused === "pickup") setPickup(result);
    else setDropoff(result);
  }, [lastFocused]);

  const goToNext = () => {
    if (step === 1) {
      if (!pickup.name.trim() || !dropoff.name.trim()) {
        toast.error("Adresses de collecte et livraison requises");
        return;
      }
      if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
        toast.error("Les adresses doivent être différentes");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!dropName.trim() || !dropPhone.trim()) {
        toast.error("Le nom et le téléphone du destinataire sont requis");
        return;
      }
      setStep(3);
    }
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
      price_xof: pricing.price_xof, commission_xof: pricing.commission_xof,
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
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[850px] overflow-hidden pb-6">
      {/* Header */}
      <header className="flex-none px-4 py-3 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate({ to: "/app" })}
          className="h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <div 
              key={n} 
              className={`h-2 rounded-full transition-all duration-500 ease-out ${n === step ? "w-8 bg-primary" : n < step ? "w-4 bg-primary/40" : "w-4 bg-muted"}`} 
            />
          ))}
        </div>
        <div className="w-10" /> {/* Spacer for alignment */}
      </header>

      {/* Main Content Scroll Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-12 space-y-6 pt-4 relative">
        
        {/* Step 1: Locations */}
        <div className={step === 1 ? "space-y-6" : "absolute opacity-0 pointer-events-none -z-10"}>
            <div>
              <h1 className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {t("book.step1.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("book.step1.desc")}
              </p>
            </div>

            <div className="space-y-3 relative">
              {/* Visual connection line between dots */}
              <div className="absolute left-6 top-[2.5rem] bottom-[2.5rem] w-px bg-border/80 border-dashed border-l z-0" />
              
              <div className="relative z-10">
                <AddressSearch
                  label={t("book.pickup")}
                  icon="A"
                  value={pickup}
                  onChange={setPickup}
                  onFocus={() => setLastFocused("pickup")}
                  placeholder={t("book.search_placeholder_pickup")}
                />
              </div>
              <div className="relative z-10">
                <AddressSearch
                  label={t("book.dropoff")}
                  icon="B"
                  value={dropoff}
                  onChange={setDropoff}
                  onFocus={() => setLastFocused("dropoff")}
                  placeholder={t("book.search_placeholder_dropoff")}
                />
              </div>
            </div>

            {/* Map Area — only loads when user clicks */}
            <div className="relative w-full h-[260px] rounded-3xl overflow-hidden border border-white/10 shadow-elegant bg-muted/20">
              {showMap ? (
                  <LiveMap
                    pickup={pickup}
                    dropoff={dropoff}
                    height={260}
                    zoom={12}
                    onMapClick={handleMapClick}
                  />
              ) : (
                /* Beautiful static placeholder — tap to load map */
                <button
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/40 via-background/60 to-muted/30 cursor-pointer group transition-all hover:from-muted/50 hover:to-muted/40"
                >
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <MapIcon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-glow">
                      <MapPin className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">{t("book.open_map")}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("book.tap_map_desc")}</p>
                  </div>
                </button>
              )}

              {/* Map UI Overlays (only shown when map is active) */}
              {showMap && (
                <>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                    <div className="bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg border border-border/50 flex items-center gap-2">
                       <div className={`h-2 w-2 rounded-full animate-pulse ${lastFocused === 'pickup' ? 'bg-primary' : 'bg-blue-500'}`} />
                       <span className="text-[10px] font-medium text-foreground uppercase tracking-wider">
                         {t("book.target")} {lastFocused === "pickup" ? t("book.target_pickup") : t("book.target_dropoff")}
                       </span>
                    </div>
                  </div>
                </>
              )}

              <div className="absolute bottom-3 right-3 pointer-events-none z-10">
                <div className="bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/50 shadow-sm">
                   <span className="text-xs font-bold text-foreground">{distance.toFixed(1)} km</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={goToNext}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-glow"
            >
              {t("book.continue")} <ArrowRight className="h-5 w-5" />
            </button>
          </div>

        {/* Step 2: Details */}
        <div className={step === 2 ? "space-y-6" : "hidden"}>
            <div>
              <h1 className="text-3xl font-display font-bold">{t("book.step2.title")}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("book.step2.desc")}</p>
            </div>

            {/* Recipient Card */}
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("book.recipient")}</h3>
                  <p className="text-xs text-muted-foreground">{t("book.recipient_desc")}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <FloatingField
                  label={t("book.full_name")}
                  value={dropName}
                  onChange={setDropName}
                  placeholder="Kofi Mensah"
                />
                <FloatingField
                  label={t("book.phone_number")}
                  value={dropPhone}
                  onChange={setDropPhone}
                  placeholder="+229 01 XX XX XX"
                  type="tel"
                />
              </div>
            </div>

            {/* Sender Card (Optional) */}
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
               <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("book.sender")}</h3>
                  <p className="text-xs text-muted-foreground">{t("book.optional")}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <FloatingField
                  label={t("book.your_name")}
                  value={pickupName}
                  onChange={setPickupName}
                  placeholder="Ama Diallo"
                />
                <FloatingField
                  label={t("book.your_phone")}
                  value={pickupPhone}
                  onChange={setPickupPhone}
                  placeholder="+229 01 XX XX XX"
                  type="tel"
                />
              </div>
            </div>

            {/* Parcel Type */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold pl-1">{t("book.what_inside")}</h3>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-3 rounded-2xl p-3 border transition-all duration-200 ${
                      category === c.value 
                        ? "border-primary bg-primary/5 shadow-sm scale-[1.02]" 
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    <span className={`text-sm font-medium ${category === c.value ? "text-primary" : "text-foreground/80"}`}>
                      {t(`book.cat.${c.value}` as keyof typeof dict)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Weight Slider */}
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("book.weight")}</h3>
                <span className="text-lg font-display font-bold text-primary">{weight} kg</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-muted rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 kg</span>
                <span>20 kg</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold pl-1">{t("book.special_instructions")}</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("book.notes_placeholder")}
                rows={3}
                className="w-full rounded-3xl bg-card border border-border p-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
              />
            </div>

            <button
              type="button"
              onClick={goToNext}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-glow"
            >
              {t("book.get_quote")} <ArrowRight className="h-5 w-5" />
            </button>
          </div>

        {/* Step 3: Confirmation */}
        <div className={step === 3 ? "space-y-6" : "hidden"}>
             <div>
              <h1 className="text-3xl font-display font-bold">{t("book.step3.title")}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("book.step3.desc")}</p>
            </div>

            {/* Delivery Speeds */}
            <div className="space-y-3">
              <TypeCard 
                active={type === "standard"} onClick={() => setType("standard")} 
                icon={Package} title={t("book.std.title")} desc={t("book.std.desc")} 
              />
              <TypeCard 
                active={type === "express"} onClick={() => setType("express")} 
                icon={Zap} title={t("book.exp.title")} desc={t("book.exp.desc")} 
                isPremium
              />
              <TypeCard 
                active={type === "scheduled"} onClick={() => setType("scheduled")} 
                icon={Clock} title={t("book.sched.title")} desc={t("book.sched.desc")} 
              />
            </div>

            {/* Add-ons */}
            <button
              type="button"
              onClick={() => setInsurance(!insurance)}
              className={`w-full rounded-3xl p-4 flex items-center justify-between border transition-all duration-300 ${
                insurance ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                 <div className={`h-10 w-10 rounded-full flex items-center justify-center ${insurance ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                   <Shield className="h-5 w-5" />
                 </div>
                 <div className="text-left">
                   <p className="text-sm font-semibold">{t("book.insurance")}</p>
                   <p className="text-xs text-muted-foreground">{t("book.insurance_desc")}</p>
                 </div>
              </div>
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${insurance ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                {insurance && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
            </button>

            {/* Receipt Summary */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
              {/* Decorative top jagged edge logic (visual only) */}
              <div className="absolute top-0 left-0 right-0 h-1 flex justify-around opacity-20">
                {Array.from({length: 20}).map((_, i) => <div key={i} className="w-2 h-2 bg-background rotate-45 -translate-y-1.5" />)}
              </div>
              
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 text-center">{t("book.receipt")}</h3>
              
              <div className="space-y-3">
                <ReceiptRow label={t("book.departure")} value={pickup.name} truncate />
                <ReceiptRow label={t("book.arrival")} value={dropoff.name} truncate />
                <ReceiptRow label={t("book.weight")} value={`${weight} kg`} />
                <ReceiptRow label={t("book.distance")} value={`${distance.toFixed(1)} km`} />
                <div className="my-3 border-t border-dashed border-border" />
                <ReceiptRow label={t("book.base_fare")} value={fmtXOF(pricing.price_xof - (insurance ? 500 : 0))} />
                {insurance && <ReceiptRow label={t("book.insurance")} value="500 FCFA" />}
                
                <div className="mt-4 pt-4 border-t border-border flex items-end justify-between">
                  <span className="text-sm font-medium">{t("book.total_pay")}</span>
                  <span className="text-3xl font-display font-bold text-primary">{fmtXOF(pricing.price_xof)}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-3 hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> {t("book.processing")}
                  </>
                ) : (
                  <>
                    {t("book.confirm_order")}
                  </>
                )}
              </button>
            </div>
          </div>

      </main>
    </div>
  );
}

// Helper Components
function FloatingField({ label, value, onChange, placeholder, type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, type?: string }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  
  return (
    <div className="relative">
      <label 
        className={`absolute left-4 transition-all duration-200 pointer-events-none z-10 ${
          active ? "text-[10px] top-1.5 text-primary font-semibold" : "text-sm top-4 text-muted-foreground"
        }`}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? placeholder : ""}
        className="w-full h-14 bg-background border border-border rounded-2xl px-4 pt-5 pb-1 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all relative z-0"
      />
    </div>
  );
}

function TypeCard({ active, onClick, icon: Icon, title, desc, isPremium }: { active: boolean, onClick: () => void, icon: any, title: string, desc: string, isPremium?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl p-4 flex items-center gap-4 border transition-all duration-300 text-left relative overflow-hidden ${
        active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      {isPremium && active && (
        <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
          <div className="absolute top-2 -right-4 bg-primary text-[8px] font-bold text-white uppercase py-0.5 px-6 rotate-45">
            Rapide
          </div>
        </div>
      )}
      
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        <Icon className="h-6 w-6" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={`text-base font-semibold ${active ? "text-primary" : "text-foreground"}`}>{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

function ReceiptRow({ label, value, truncate }: { label: string, value: string, truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 border-b border-dotted border-border/50 mx-2 self-end mb-1" />
      <span className={`font-semibold ${truncate ? "truncate max-w-[50%] text-right" : ""}`}>{value}</span>
    </div>
  );
}
