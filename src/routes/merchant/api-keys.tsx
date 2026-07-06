import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Plus, Copy, Trash2, Check, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/merchant/api-keys")({
  component: MerchantApiKeys,
});

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(40);
  crypto.getRandomValues(arr);
  return (
    "rpd_" +
    Array.from(arr)
      .map((b) => chars[b % chars.length])
      .join("")
  );
}

// SHA-256 hash of the key, hex-encoded — this is what's stored at rest.
// The plaintext key is only ever known client-side, right after creation,
// and is never sent back by the server again.
async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function MerchantApiKeys() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["merchant-api-keys", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_api_keys")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const key = generateKey();
      const keyHash = await hashKey(key);
      const { error } = await supabase.from("merchant_api_keys").insert({
        user_id: user!.id,
        name: name || "Untitled Key",
        key_hash: keyHash,
        key_prefix: key.slice(0, 12),
        is_active: true,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      qc.invalidateQueries({ queryKey: ["merchant-api-keys"] });
      setNewName("");
      setCreating(false);
      setRevealKey(key);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create key"),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("merchant_api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-api-keys"] });
      toast.success("Key revoked");
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Integrate Rapide directly into your system
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> New Key
        </button>
      </div>

      {/* Reveal-once modal — the plaintext key only ever exists here, right
          after creation; it is hashed before storage and can never be shown again. */}
      <AnimatePresence>
        {revealKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-strong w-full max-w-md rounded-3xl p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-bold">Copy your key now</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                This is the only time the full key is shown. It's stored hashed — if you lose it,
                you'll need to generate a new one.
              </p>
              <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl p-3 mb-4">
                <code className="text-xs font-mono flex-1 break-all">{revealKey}</code>
                <button
                  onClick={() => copyToClipboard(revealKey, "reveal")}
                  className="shrink-0 h-8 w-8 rounded-lg glass flex items-center justify-center"
                >
                  {copied === "reveal" ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <button
                onClick={() => setRevealKey(null)}
                className="w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Done — I've copied it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      {creating && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-5 border border-primary/30"
        >
          <p className="font-semibold mb-3">Create New API Key</p>
          <input
            type="text"
            placeholder="Key name (e.g. Production, Staging)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createKey.mutate(newName)}
              disabled={createKey.isPending}
              className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {createKey.isPending ? "Generating..." : "Generate Key"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-xl glass px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* API docs snippet */}
      <div className="glass rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Integration
        </p>
        <pre className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 overflow-x-auto">
          {`curl -X POST https://api.rapide.bj/v1/orders \\
  -H "Authorization: Bearer rpd_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"pickup_address":"...","dropoff_address":"..."}'`}
        </pre>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span className="glass rounded-lg px-2 py-1">Base URL: api.rapide.bj/v1</span>
          <span className="glass rounded-lg px-2 py-1">Auth: Bearer token</span>
          <span className="glass rounded-lg px-2 py-1">Format: JSON</span>
        </div>
      </div>

      {/* Keys list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : keys?.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl">
          <Key className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold">No API keys yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first key to start integrating
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys?.map((k) => (
            <div
              key={k.id}
              className={`glass-strong rounded-2xl p-4 border ${k.is_active ? "border-border" : "border-destructive/20 opacity-60"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{k.name}</p>
                    {!k.is_active && (
                      <span className="text-xs text-destructive glass rounded-full px-2 py-0.5">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground">
                      {k.key_prefix}••••••••••••••••••••••••••••
                    </code>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Created {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    {k.last_used_at &&
                      ` · Last used ${new Date(k.last_used_at).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyToClipboard(k.key_prefix, k.id)}
                    className="h-8 w-8 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Copy prefix"
                  >
                    {copied === k.id ? (
                      <Check className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {k.is_active && (
                    <button
                      onClick={() => revokeKey.mutate(k.id)}
                      disabled={revokeKey.isPending}
                      className="h-8 w-8 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-destructive"
                      title="Revoke key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
