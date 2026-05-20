import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { User, Star, Package, Phone, Mail, LogOut, ChevronRight, Edit2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useWallet, useRiderProfile } from "@/hooks/use-queries";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/profile")({
  component: RiderProfile,
});

function RiderProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const { data: profile } = useProfile(user?.id);
  const { data: rider }   = useRiderProfile(user?.id);
  const { data: wallet }  = useWallet(user?.id);

  const saveName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditingName(false);
      toast.success("Name updated");
    },
    onError: () => toast.error("Failed to save"),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "R";

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Profile</h1>

      {/* Avatar + name */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-3xl p-6 text-center relative"
      >
        <div className="h-20 w-20 rounded-full bg-gradient-primary mx-auto flex items-center justify-center mb-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-bold text-primary-foreground">{initials}</span>
          )}
        </div>

        {editingName ? (
          <div className="flex items-center gap-2 justify-center">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="rounded-xl bg-input/40 border border-border px-3 py-1.5 text-sm outline-none focus:border-primary text-center"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveName.mutate(nameInput)}
            />
            <button
              onClick={() => saveName.mutate(nameInput)}
              className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <p className="font-display text-xl font-bold">{profile?.full_name ?? "Rider"}</p>
            <button
              onClick={() => { setNameInput(profile?.full_name ?? ""); setEditingName(true); }}
              className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div>
            <p className="font-display text-xl font-bold text-gradient-primary">
              {fmtXOF(wallet?.balance_xof ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Wallet</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold flex items-center justify-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              {Number(rider?.rating ?? 5).toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold">{rider?.total_deliveries ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Deliveries</p>
          </div>
        </div>
      </motion.div>

      {/* Info section */}
      <div className="glass rounded-2xl divide-y divide-border">
        <div className="flex items-center gap-3 p-4">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium">{profile?.phone ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Package className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Vehicle</p>
            <p className="text-sm font-medium capitalize">
              {rider?.vehicle_type ?? "—"}{rider?.license_plate ? ` · ${rider.license_plate}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className={`text-sm font-medium ${rider?.is_online ? "text-green-400" : "text-muted-foreground"}`}>
              {rider?.is_online ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass rounded-2xl divide-y divide-border">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 p-4 text-destructive hover:bg-destructive/5 transition rounded-2xl"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">Sign out</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
    </div>
  );
}
