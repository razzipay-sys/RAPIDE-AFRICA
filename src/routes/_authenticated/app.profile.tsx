import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut, Moon, Sun, Languages, ChevronRight,
  Package, Star, MapPin, Plus, Trash2, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

// ── Saved address local storage helpers ───────────────────────────────────────
type SavedAddress = { id: string; label: string; address: string };

function loadSavedAddresses(): SavedAddress[] {
  try {
    return JSON.parse(localStorage.getItem("saved_addresses") ?? "[]");
  } catch {
    return [];
  }
}
function saveSavedAddresses(list: SavedAddress[]) {
  localStorage.setItem("saved_addresses", JSON.stringify(list));
}

// ── Component ──────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useT();
  const navigate = useNavigate();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(loadSavedAddresses);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, price_xof, customer_rating, status")
        .eq("customer_id", user!.id);

      const total = orders?.length ?? 0;
      const delivered = orders?.filter((o) => o.status === "delivered").length ?? 0;
      const totalSpent = orders
        ?.filter((o) => o.status === "delivered")
        .reduce((s, o) => s + Number(o.price_xof), 0) ?? 0;
      const rated = orders?.filter((o) => o.customer_rating != null) ?? [];
      const avgRating =
        rated.length > 0
          ? rated.reduce((s, o) => s + Number(o.customer_rating), 0) / rated.length
          : null;

      return { total, delivered, totalSpent, avgRating };
    },
    enabled: !!user,
  });

  const addAddress = () => {
    if (!newLabel.trim() || !newAddress.trim()) return;
    const next = [
      ...savedAddresses,
      { id: crypto.randomUUID(), label: newLabel.trim(), address: newAddress.trim() },
    ];
    setSavedAddresses(next);
    saveSavedAddresses(next);
    setNewLabel("");
    setNewAddress("");
    setAddingAddress(false);
    toast.success(t("profile.saved_address"));
  };

  const removeAddress = (id: string) => {
    const next = savedAddresses.filter((a) => a.id !== id);
    setSavedAddresses(next);
    saveSavedAddresses(next);
  };

  const initial = (profile?.full_name?.[0] ?? user?.email?.[0] ?? "R").toUpperCase();

  return (
    <div className="space-y-5">
      {/* Avatar + name */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="h-16 w-16 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center font-display text-2xl font-bold text-primary-foreground shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold truncate">
            {profile?.full_name ?? t("profile.user")}
          </p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
        </div>
      </motion.header>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="glass rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-xl font-bold">{stats?.delivered ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("profile.deliveries")}
          </p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-lg font-bold leading-tight">
            {stats ? fmtXOF(stats.totalSpent) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("profile.total_spent")}
          </p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </div>
          <p className="font-display text-xl font-bold">
            {stats?.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("profile.avg_rating")}
          </p>
        </div>
      </motion.div>

      {/* Saved addresses */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {t("profile.saved_addresses")}
          </h2>
          <button
            onClick={() => setAddingAddress((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("profile.add")}
          </button>
        </div>

        <AnimatePresence>
          {addingAddress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="glass rounded-2xl p-4 space-y-2">
                <input
                  type="text"
                  placeholder={t("profile.label_hint")}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder={t("profile.address_hint")}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full rounded-xl bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingAddress(false)}
                    className="flex-1 rounded-xl glass py-2 text-xs font-semibold"
                  >
                    {t("profile.cancel")}
                  </button>
                  <button
                    onClick={addAddress}
                    disabled={!newLabel.trim() || !newAddress.trim()}
                    className="flex-1 rounded-xl bg-gradient-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {t("profile.save")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {savedAddresses.length > 0 ? (
          <div className="space-y-2">
            {savedAddresses.map((a) => (
              <div key={a.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.address}</p>
                </div>
                <button
                  onClick={() => removeAddress(a.id)}
                  className="h-7 w-7 rounded-lg glass flex items-center justify-center shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            {t("profile.no_addresses")}
          </p>
        )}
      </motion.section>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl divide-y divide-border"
      >
        <button onClick={toggle} className="w-full p-4 flex items-center gap-3 text-left">
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-primary" />
          ) : (
            <Moon className="h-4 w-4 text-primary" />
          )}
          <span className="flex-1 text-sm">{t("profile.theme")}</span>
          <span className="text-xs text-muted-foreground capitalize">{theme}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <Languages className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm">{t("profile.language")}</span>
          <span className="text-xs text-muted-foreground">{lang.toUpperCase()}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </motion.div>

      {/* Sign out */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        onClick={async () => { await signOut(); navigate({ to: "/" }); }}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-destructive"
      >
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-medium">{t("profile.signout")}</span>
      </motion.button>
    </div>
  );
}
