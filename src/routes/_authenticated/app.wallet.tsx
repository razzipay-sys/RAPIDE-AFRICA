import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const { t, lang } = useT();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: txs } = useQuery({
    queryKey: ["wallet-tx", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">{t("wallet.title")}</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("wallet.balance")}</p>
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 font-display text-4xl font-bold text-gradient-primary">{fmtXOF(wallet?.balance_xof ?? 0)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">{t("wallet.topup")}</button>
            <button className="rounded-xl glass px-4 py-2.5 text-sm font-semibold">{t("wallet.withdraw")}</button>
          </div>
        </div>
      </motion.div>

      <section>
        <h2 className="font-display text-sm font-semibold mb-2">{t("wallet.transactions")}</h2>
        {txs?.length === 0 && <p className="text-sm text-muted-foreground glass rounded-2xl p-4">{t("wallet.no_tx")}</p>}
        <ul className="space-y-2">
          {txs?.map((tx) => {
            const credit = tx.amount_xof >= 0;
            return (
              <li key={tx.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${credit ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description ?? tx.type}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(tx.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}</p>
                </div>
                <p className={`text-sm font-semibold ${credit ? "text-primary" : ""}`}>
                  {credit ? "+" : ""}{fmtXOF(tx.amount_xof)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
