import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, Search, Shield, ShieldOff, User, Mail, Phone, Calendar, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  email?: string;
  wallet_balance?: number;
  order_count?: number;
  is_banned?: boolean;
};

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select(`
          id, full_name, phone, avatar_url, created_at,
          wallets (balance_xof),
          orders (id)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) {
        q = q.ilike("full_name", `%${search.trim()}%`);
      }
      const { data } = await q;
      return (data ?? []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        phone: u.phone,
        avatar_url: u.avatar_url,
        created_at: u.created_at,
        wallet_balance: u.wallets?.[0]?.balance_xof ?? 0,
        order_count: u.orders?.length ?? 0,
      })) as UserRow[];
    },
    staleTime: 30000,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data ?? [];
    },
  });

  const toggleBan = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      if (ban) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "banned" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "banned");
        if (error) throw error;
      }
    },
    onSuccess: (_, { ban }) => {
      toast.success(ban ? "User banned" : "User unbanned");
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: () => toast.error("Failed to update user"),
  });

  const roleMap = Object.fromEntries(
    (roles ?? []).map((r) => [r.user_id, r.role])
  );

  const totalUsers = users?.length ?? 0;
  const totalBalance = users?.reduce((s, u) => s + (u.wallet_balance ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{totalUsers} registered customers</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total wallets:</span>
          <span className="font-bold text-foreground">{fmtXOF(totalBalance)}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-input/40 border border-border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* User table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">User</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Wallet</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Orders</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Joined</th>
              <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border/50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-8 rounded-lg bg-white/5 animate-pulse" />
                  </td>
                </tr>
              ))}
            {!isLoading && users?.map((u, idx) => {
              const isBanned = roleMap[u.id] === "banned";
              const isAdmin = roleMap[u.id] === "admin";
              const initials = u.full_name
                ? u.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                : "?";
              return (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-border/50 hover:bg-white/3 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-[11px] font-bold text-primary-foreground">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.full_name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{u.phone ?? "No phone"}</p>
                      </div>
                      {isAdmin && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      )}
                      {isBanned && (
                        <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                          Banned
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{fmtXOF(u.wallet_balance ?? 0)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.order_count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleBan.mutate({ userId: u.id, ban: !isBanned })}
                      disabled={isAdmin || toggleBan.isPending}
                      title={isBanned ? "Unban user" : "Ban user"}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center ml-auto transition ${
                        isBanned
                          ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                          : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {isBanned ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {!isLoading && !users?.length && (
          <div className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
