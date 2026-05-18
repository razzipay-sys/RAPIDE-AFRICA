import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MapPin, Package, Shield, Zap, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CITIES, haversineKm, quote, fmtXOF, type DeliveryType } from "@/lib/pricing";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/book")({
  component: BookPage,
});

function BookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [pickup, setPickup] = useState(CITIES[0]);
  const [dropoff, setDropoff] = useState(CITIES[3]);
  const [pickupName, setPickupName] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [dropName, setDropName] = useState("");
  const [dropPhone, setDropPhone] = useState("");

  const [category, setCategory] = useState<"document" | "food" | "electronics" | "clothing" | "fragile" | "other">("document");
  const [weight, setWeight] = useState(2);
  const [notes, setNotes] = useState("");

  const [type, setType] = useState<DeliveryType>("standard");
  const [insurance, setInsurance] = useState(false);

  const distance = useMemo(() => haversineKm(pickup, dropoff), [pickup, dropoff]);
  const q = useMemo(() => quote({ distanceKm: distance, type, insurance, weightKg: weight }), [distance, type, insurance, weight]);

  const CATEGORIES = [
    { value: "document" as const, labelKey: "book.cat.document" as const },
    { value: "food" as const, labelKey: "book.cat.food" as const },
    { value: "electronics" as const, labelKey: "book.cat.electronics" as const },
    { value: "clothing" as const, labelKey: "book.cat.clothing" as const },
    { value: "fragile" as const, labelKey: "book.cat.fragile" as const },
    { value: "other" as const, labelKey: "book.cat.other" as const },
  ];

  const submit = async () => {
    if (!user) return;
    if (!dropName || !dropPhone) {
      toast.error(t("book.recipient_err"));
      return;
    }
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
      toast.error(error?.message ?? t("book.recipient_err"));
      return;
    }
    await supabase.from("order_events").insert({
      order_id: data.id, status: "pending", created_by: user.id, note: "Commande créée",
    });
    toast.success(t("book.success"));
    navigate({ to: "/app/track/$orderId", params: { orderId: data.id } });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate({ to: "/app" })} className="glass h-9 w-9 rounded-xl flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 w-8 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="w-9" />
      </header>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-bold">{t("book.step1.title")}</h1>
            <CitySelect label={t("book.pickup")} icon="A" value={pickup} onChange={setPickup} />
            <CitySelect label={t("book.dropoff")} icon="B" value={dropoff} onChange={setDropoff} />
            <div className="glass rounded-2xl p-4 grid grid-cols-2 gap-3">
              <Field label={t("book.contact_pickup")} value={pickupName} onChange={setPickupName} placeholder={t("book.contact_pickup")} />
              <Field label={t("book.phone")} value={pickupPhone} onChange={setPickupPhone} placeholder="+229" />
              <Field label={t("book.recipient")} value={dropName} onChange={setDropName} placeholder={t("book.recipient")} />
              <Field label={t("book.phone_req")} value={dropPhone} onChange={setDropPhone} placeholder="+229" />
            </div>
            <p className="text-xs text-muted-foreground text-center">{distance.toFixed(1)} {t("book.distance_est")}</p>
            <button onClick={() => setStep(2)} className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2">
              {t("book.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-bold">{t("book.step2.title")}</h1>
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("book.category")}</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => setCategory(c.value)}
                    className={`rounded-xl px-3 py-2.5 text-sm border transition ${category === c.value ? "border-primary bg-primary/10 text-primary" : "border-border glass"}`}>
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{t("book.weight")} : <span className="text-foreground font-medium">{weight} kg</span></p>
              <input type="range" min={1} max={20} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full mt-2 accent-[var(--primary)]" />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("book.notes_placeholder")} rows={3}
              className="w-full rounded-2xl bg-input/40 border border-border p-4 text-sm outline-none focus:border-primary" />
            <button onClick={() => setStep(3)} className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2">
              {t("book.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-2xl font-bold">{t("book.step3.title")}</h1>
            <div className="space-y-2">
              <TypeOption active={type === "standard"} onClick={() => setType("standard")} icon={Package} title={t("book.std.title")} desc={t("book.std.desc")} />
              <TypeOption active={type === "express"} onClick={() => setType("express")} icon={Zap} title={t("book.exp.title")} desc={t("book.exp.desc")} />
              <TypeOption active={type === "scheduled"} onClick={() => setType("scheduled")} icon={Clock} title={t("book.sched.title")} desc={t("book.sched.desc")} />
            </div>
            <button onClick={() => setInsurance(!insurance)} className={`w-full rounded-2xl p-4 flex items-center justify-between border transition ${insurance ? "border-primary bg-primary/10" : "border-border glass"}`}>
              <span className="flex items-center gap-3 text-sm"><Shield className="h-4 w-4 text-primary" /> {t("book.insurance")}</span>
              <span className={`h-5 w-5 rounded-full border-2 ${insurance ? "border-primary bg-primary" : "border-muted-foreground"}`} />
            </button>

            <div className="glass-strong rounded-2xl p-5 space-y-1.5">
              <Row label={t("book.distance")} value={`${distance.toFixed(1)} km`} />
              <Row label="Type" value={type} />
              <Row label={t("book.commission")} value={fmtXOF(q.commission_xof)} muted />
              <div className="h-px bg-border my-2" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t("book.total")}</span>
                <span className="font-display text-2xl font-bold text-gradient-primary">{fmtXOF(q.price_xof)}</span>
              </div>
            </div>

            <button onClick={submit} disabled={submitting} className="w-full rounded-xl bg-gradient-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} {t("book.confirm")} · {fmtXOF(q.price_xof)}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

function CitySelect({ label, icon, value, onChange }: { label: string; icon: string; value: typeof CITIES[number]; onChange: (c: typeof CITIES[number]) => void }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{icon}</div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <select value={value.name} onChange={(e) => onChange(CITIES.find((c) => c.name === e.target.value) ?? value)}
            className="w-full bg-transparent text-sm font-medium outline-none">
            {CITIES.map((c) => <option key={c.name} value={c.name} className="bg-background">{c.name}</option>)}
          </select>
        </div>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 bg-transparent border-b border-border py-1.5 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function TypeOption({ active, onClick, icon: Icon, title, desc }: { active: boolean; onClick: () => void; icon: any; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`w-full rounded-2xl p-4 flex items-center gap-3 border transition text-left ${active ? "border-primary bg-primary/10" : "border-border glass"}`}>
      <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className={`h-5 w-5 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-muted-foreground"}`} />
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}
