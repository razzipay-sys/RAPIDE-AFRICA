import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { SkeletonListItem, SkeletonStatCard } from "@/components/rapide/SkeletonCard";
import { EmptyState } from "@/components/rapide/EmptyState";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletPage,
});

const TX_TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  topup:      { fr: "Rechargement", en: "Top-up" },
  payment:    { fr: "Paiement", en: "Payment" },
  refund:     { fr: "Remboursement", en: "Refund" },
  payout:     { fr: "Paiement coursier", en: "Rider payout" },
  bonus:      { fr: "Bonus", en: "Bonus" },
  commission: { fr: "Commission", en: "Commission" },
};

function WalletPage() {
  const { user } = useAuth();
  const { t, lang } = useT();

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: txs, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-tx", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
    enabled: !!user,
  });

  const thisMonthTotal = txs
    ?.filter((tx) => {
      const d = new Date(tx.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        && ["topup"].includes(tx.type);
    })
    .reduce((s, tx) => s + Number(tx.amount_xof), 0) ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">{t("wallet.title")}</h1>

      {/* Balance card */}
      {walletLoading ? (
        <SkeletonStatCard />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-radial opacity-60 pointer-events-none" />
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/10" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("wallet.balance")}</p>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="font-display text-4xl font-bold text-gradient-primary">
              {fmtXOF(wallet?.balance_xof ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {lang === "fr" ? "Ce mois :" : "This month:"}{" "}
              <span className="text-green-400 font-medium">+{fmtXOF(thisMonthTotal)}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Top-up info banner */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4 flex items-start gap-3 border border-primary/20"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {lang === "fr"
              ? "Rechargement Mobile Money bientôt disponible"
              : "Wallet top-up via Mobile Money launching soon"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "fr"
              ? "Contactez le support pour ajouter des fonds manuellement."
              : "Contact support to add funds manually."}
          </p>
        </div>
      </motion.div>

      {/* Transactions */}
      <section>
        <h2 className="font-display text-sm font-semibold mb-3">{t("wallet.transactions")}</h2>

        {txLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <SkeletonListItem key={i} />)}
          </div>
        )}

        {!txLoading && txs?.length === 0 && (
          <EmptyState icon={Wallet} title={t("wallet.no_tx")} />
        )}

        {!txLoading && txs && txs.length > 0 && (
          <div className="space-y-2">
            {txs.map((tx, idx) => {
              const credit = Number(tx.amount_xof) >= 0;
              const label = TX_TYPE_LABEL[tx.type]?.[lang as "fr" | "en"] ?? tx.type;
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass rounded-2xl p-3.5 flex items-center gap-3"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    credit ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"
                  }`}>
                    {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tx.description ?? label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${credit ? "text-green-400" : "text-destructive"}`}>
                    {credit ? "+" : ""}{fmtXOF(Number(tx.amount_xof))}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
