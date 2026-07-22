import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LogOut,
  Moon,
  Sun,
  Languages,
  ChevronRight,
  Package,
  Star,
  MapPin,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { fmtXOF } from "@/lib/pricing";
import { isSuccessfulDelivery } from "@/lib/order-lifecycle";
import { AddressSearch } from "@/components/rapide/AddressSearch";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

type SavedPlace = Tables<"saved_places">;

const savedPlaceSchema = z.object({
  label: z.string().trim().min(1, "Required"),
  place: z.object({
    address: z.string().min(1, "Please select an address"),
    lat: z.number(),
    lng: z.number(),
  }),
});
type SavedPlaceValues = z.infer<typeof savedPlaceSchema>;

// ── Component ──────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [addingAddress, setAddingAddress] = useState(false);

  const addressForm = useForm<SavedPlaceValues>({
    resolver: zodResolver(savedPlaceSchema),
    defaultValues: { label: "", place: { address: "", lat: 0, lng: 0 } },
  });

  const { data: savedAddresses } = useQuery({
    queryKey: ["saved-places", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addAddress = useMutation({
    mutationFn: async (values: SavedPlaceValues) => {
      const { error } = await supabase.from("saved_places").insert({
        user_id: user!.id,
        label: values.label,
        address: values.place.address,
        lat: values.place.lat,
        lng: values.place.lng,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-places", user?.id] });
      addressForm.reset({ label: "", place: { address: "", lat: 0, lng: 0 } });
      setAddingAddress(false);
      toast.success(t("profile.saved_address"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_places").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["saved-places", user?.id] });
      const previous = qc.getQueryData<SavedPlace[]>(["saved-places", user?.id]);
      qc.setQueryData<SavedPlace[]>(["saved-places", user?.id], (old) =>
        old?.filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(["saved-places", user?.id], context.previous);
      toast.error("Failed to remove address");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-places", user?.id] }),
  });

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
      const delivered = orders?.filter((o) => isSuccessfulDelivery(o.status)).length ?? 0;
      const totalSpent =
        orders
          ?.filter((o) => isSuccessfulDelivery(o.status))
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
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("profile.deliveries")}</p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-lg font-bold leading-tight">
            {stats ? fmtXOF(stats.totalSpent) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("profile.total_spent")}</p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </div>
          <p className="font-display text-xl font-bold">
            {stats?.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("profile.avg_rating")}</p>
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
              <Form {...addressForm}>
                <form
                  onSubmit={addressForm.handleSubmit((values) => addAddress.mutate(values))}
                  className="glass rounded-2xl p-4 space-y-2"
                >
                  <FormField
                    control={addressForm.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("profile.label_hint")}
                            className="w-full rounded-xl bg-input/40 border border-border px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addressForm.control}
                    name="place"
                    render={({ field }) => (
                      <FormItem className="relative z-[60]">
                        <FormControl>
                          <AddressSearch
                            label={t("profile.address_hint")}
                            icon="+"
                            placeholder={t("profile.address_hint")}
                            value={
                              field.value.address
                                ? {
                                    name: field.value.address,
                                    lat: field.value.lat,
                                    lng: field.value.lng,
                                  }
                                : null
                            }
                            onChange={(r) =>
                              field.onChange({ address: r.name, lat: r.lat, lng: r.lng })
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingAddress(false)}
                      className="flex-1 rounded-xl glass py-2 text-xs font-semibold"
                    >
                      {t("profile.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={addAddress.isPending}
                      className="flex-1 rounded-xl bg-gradient-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
                    >
                      {t("profile.save")}
                    </button>
                  </div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>

        {savedAddresses && savedAddresses.length > 0 ? (
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
                  onClick={() => removeAddress.mutate(a.id)}
                  aria-label={`Remove ${a.label}`}
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
        onClick={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-destructive"
      >
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-medium">{t("profile.signout")}</span>
      </motion.button>
    </div>
  );
}
