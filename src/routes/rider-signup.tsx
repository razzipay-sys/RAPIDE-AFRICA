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
  { type: "motorbike", icon: Bike,  labelFr: "Moto",    labelEn: "Motorbike" },
  { type: "bicycle",   icon: Bike,  labelFr: "Vélo",    labelEn: "Bicycle" },
  { type: "car",       icon: Car,   labelFr: "Voiture", labelEn: "Car" },
  { type: "van",       icon: Truck, labelFr: "Camion",  labelEn: "Van" },
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -40, transition: { duration: 0.18 } }),
};

function RiderSignupPage() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — personal info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — vehicle info
  const [vehicle, setVehicle]       = useState<VehicleType>("motorbike");
  const [licensePlate, setLicensePlate] = useState("");

  const goTo = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const validateStep1 = () => {
    if (!fullName.trim()) { toast.error(lang === "fr" ? "Nom requis" : "Name required"); return false; }
    if (!phone.trim())    { toast.error(lang === "fr" ? "Téléphone requis" : "Phone required"); return false; }
    if (!email.trim())    { toast.error(lang === "fr" ? "Email requis" : "Email required"); return false; }
    if (password.length < 8) {
      toast.error(lang === "fr" ? "Mot de passe : 8 caractères minimum" : "Password must be at least 8 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim()) {
      toast.error(lang === "fr" ? "Numéro de plaque requis" : "License plate required");
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

      // 3. Assign rider role
      const { error: roleErr } = await supabase.from("user_roles").upsert({
        user_id: authData.user.id,
        role: "rider",
      });
      if (roleErr) {
        toast.error(t("errors.unexpected"));
        console.error("[rider-signup] role assignment failed:", roleErr.message);
      }

      if (authData.session) {
        // Immediately signed in (email confirmation disabled)
        toast.success(lang === "fr" ? "Bienvenue dans la flotte Rapide !" : "Welcome to the Rapide fleet!");
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
            <img src={rapideLogo} alt="Rapide" className="h-9 w-9 rounded-xl object-cover shadow-glow" />
            <span className="font-display text-base font-bold">Rapide</span>
          </Link>
          {step > 1 && step < 3 && (
            <button
              onClick={() => goTo(step - 1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {lang === "fr" ? "Retour" : "Back"}
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
              <h1 className="font-display text-2xl font-bold">
                {lang === "fr" ? "Rejoindre la flotte" : "Join the fleet"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground mb-6">
                {lang === "fr" ? "Créez votre compte coursier" : "Create your rider account"}
              </p>

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
                {lang === "fr" ? "Suivant" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {lang === "fr" ? "Déjà coursier ?" : "Already a rider?"}{" "}
                <Link to="/login" search={{ redirect: "/rider" }} className="text-primary font-medium">
                  {t("login.btn")}
                </Link>
              </p>

              <p className="mt-3 text-center text-sm text-muted-foreground">
                {lang === "fr" ? "Vous êtes client ?" : "Looking to send?"}{" "}
                <Link to="/signup" className="text-primary font-medium">
                  {lang === "fr" ? "Inscription client" : "Customer signup"}
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
              <h2 className="font-display text-2xl font-bold">
                {lang === "fr" ? "Votre véhicule" : "Your vehicle"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground mb-6">
                {lang === "fr"
                  ? "Sélectionnez votre type de véhicule"
                  : "Select your vehicle type"}
              </p>

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
                      <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-semibold">
                        {lang === "fr" ? v.labelFr : v.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                required
                placeholder={lang === "fr" ? "Numéro de plaque (ex: BJ-1234-AB)" : "License plate (e.g. BJ-1234-AB)"}
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
                {loading
                  ? (lang === "fr" ? "Création du compte…" : "Creating account…")
                  : (lang === "fr" ? "Créer mon compte coursier" : "Create my rider account")}
              </button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {lang === "fr"
                  ? "Vos documents seront demandés après inscription pour vérification KYC."
                  : "Your documents will be requested after signup for KYC verification."}
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
              <h2 className="font-display text-2xl font-bold mb-2">
                {lang === "fr" ? "Vérifiez votre email" : "Check your email"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {lang === "fr"
                  ? `Un lien de confirmation a été envoyé à ${email}. Cliquez dessus pour activer votre compte coursier.`
                  : `A confirmation link was sent to ${email}. Click it to activate your rider account.`}
              </p>
              <Link
                to="/login"
                search={{ redirect: "/rider" }}
                className="inline-block rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                {lang === "fr" ? "Aller à la connexion" : "Go to sign in"}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
