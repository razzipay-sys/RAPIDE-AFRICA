import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Bike, Car, Truck, CheckCircle2, Loader2 } from "lucide-react";
import rapideLogo from "@/assets/rapide-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { sanitizeAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/rider-signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/rider" });
  },
  component: RiderSignupPage,
});

type VehicleType = "motorbike" | "bicycle" | "car" | "van" | "truck";

const VEHICLES: { type: VehicleType; icon: typeof Bike; labelFr: string; labelEn: string }[] = [
  { type: "motorbike", icon: Bike, labelFr: "Moto", labelEn: "Motorbike" },
  { type: "bicycle", icon: Bike, labelFr: "Vélo", labelEn: "Bicycle" },
  { type: "car", icon: Car, labelFr: "Voiture", labelEn: "Car" },
  { type: "van", icon: Truck, labelFr: "Camion", labelEn: "Van" },
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, transition: { duration: 0.18 } }),
};

function RiderSignupPage() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — personal info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — vehicle info
  const [vehicle, setVehicle] = useState<VehicleType>("motorbike");
  const [licensePlate, setLicensePlate] = useState("");

  const goTo = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const validateStep1 = () => {
    if (!fullName.trim()) {
      toast.error(t("auto.namerequired"));
      return false;
    }
    if (!phone.trim()) {
      toast.error(t("auto.phonerequired"));
      return false;
    }
    if (!email.trim()) {
      toast.error(t("auto.emailrequired"));
      return false;
    }
    if (password.length < 8) {
      toast.error(t("auto.passwordmustbea"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim()) {
      toast.error(t("auto.licenseplatereq"));
      return;
    }
    setLoading(true);
    try {
      // 1. Create auth account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/rider",
          data: { full_name: fullName.trim(), phone: phone.trim(), locale: lang },
        },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error("Signup failed");

      // 2. Upsert rider record (profile + wallet created by Supabase trigger)
      const { error: riderErr } = await supabase.from("riders").upsert({
        user_id: authData.user.id,
        vehicle_type: vehicle,
        license_plate: licensePlate.trim().toUpperCase(),
        kyc_status: "pending",
        is_online: false,
        rating: 5,
        total_deliveries: 0,
      });
      if (riderErr) {
        toast.error(t("errors.unexpected"));
        console.error("[rider-signup] rider upsert failed:", riderErr.message);
      }

      // 3. Assign rider role — user_roles INSERT is admin-only by RLS, so a
      // brand-new user can't upsert this directly; request_rider_role() is a
      // SECURITY DEFINER RPC that only ever grants 'rider' to auth.uid().
      const { error: roleErr } = await supabase.rpc("request_rider_role");
      if (roleErr) {
        toast.error(t("errors.unexpected"));
        console.error("[rider-signup] role assignment failed:", roleErr.message);
      }

      if (authData.session) {
        // Immediately signed in (email confirmation disabled)
        toast.success(t("auto.welcometotherap"));
        navigate({ to: "/rider" });
      } else {
        // Email confirmation required
        goTo(3);
      }
    } catch (err) {
      toast.error(sanitizeAuthError(err, lang as "fr" | "en"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-md rounded-3xl p-8"
      >
        {/* Logo + back link */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={rapideLogo}
              alt="Rapide"
              className="h-9 w-9 rounded-xl object-cover shadow-glow"
            />
            <span className="font-display text-base font-bold">Rapide</span>
          </Link>
          {step > 1 && step < 3 && (
            <button
              onClick={() => goTo(step - 1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("auto.back")}
            </button>
          )}
        </div>

        {/* Progress dots */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir}>
          {/* ── STEP 1: Personal info ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <h1 className="font-display text-2xl font-bold">{t("auto.jointhefleet")}</h1>
              <p className="mt-1 text-sm text-muted-foreground mb-6">{t("auto.createyourrider")}</p>

              <div className="space-y-3">
                <input
                  required
                  autoComplete="name"
                  placeholder={t("signup.fullname")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <input
                  required
                  autoComplete="tel"
                  placeholder={t("signup.phone")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t("signup.password_hint")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={() => validateStep1() && goTo(2)}
                className="mt-5 w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 hover:scale-[1.01] transition active:scale-[0.98]"
              >
                {t("auto.next")}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {t("auto.alreadyarider")}{" "}
                <Link
                  to="/login"
                  search={{ redirect: "/rider" }}
                  className="text-primary font-medium"
                >
                  {t("login.btn")}
                </Link>
              </p>

              <p className="mt-3 text-center text-sm text-muted-foreground">
                {t("auto.lookingtosend")}{" "}
                <Link to="/signup" className="text-primary font-medium">
                  {t("auto.customersignup")}
                </Link>
              </p>
            </motion.div>
          )}

          {/* ── STEP 2: Vehicle info ── */}
          {step === 2 && (
            <motion.form
              key="step2"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onSubmit={handleSubmit}
            >
              <h2 className="font-display text-2xl font-bold">{t("auto.yourvehicle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground mb-6">{t("auto.selectyourvehic")}</p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {VEHICLES.map((v) => {
                  const Icon = v.icon;
                  const selected = vehicle === v.type;
                  return (
                    <button
                      key={v.type}
                      type="button"
                      onClick={() => setVehicle(v.type)}
                      className={`flex flex-col items-center gap-2 rounded-2xl p-4 border-2 transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border glass hover:border-primary/40"
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="text-xs font-semibold">
                        {v.type === "motorbike"
                          ? t("auto.motorbike")
                          : v.type === "bicycle"
                            ? t("auto.bicycle")
                            : v.type === "car"
                              ? t("auto.car")
                              : t("auto.van")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                required
                placeholder={t("auto.licenseplateegb")}
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-5 uppercase"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2 hover:scale-[1.01] transition active:scale-[0.98]"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t("auto.creatingaccount") : t("auto.createmyriderac")}
              </button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t("auto.yourdocumentswi")}
              </p>
            </motion.form>
          )}

          {/* ── STEP 3: Email confirmation ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center py-4"
            >
              <div className="flex items-center justify-center mb-5">
                <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold mb-2">{t("auto.checkyouremail")}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("rider.confirmation_sent" as any).replace("{email}", email)}
              </p>
              <Link
                to="/login"
                search={{ redirect: "/rider" }}
                className="inline-block rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                {t("auto.gotosignin")}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
