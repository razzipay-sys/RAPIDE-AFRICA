import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet, Plus, ArrowLeft, CreditCard, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { SkeletonListItem, SkeletonStatCard } from "@/components/rapide/SkeletonCard";
import { EmptyState } from "@/components/rapide/EmptyState";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletPage,
});

const QUICK_TOPUP = [1000, 2500, 5000, 10000];

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
  const [topupOpen, setTopupOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

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

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setTopupOpen(true)}
                className="rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> {t("wallet.topup")}
              </button>
              <button
                onClick={() => toast.info(lang === "fr" ? "Retrait bientôt disponible" : "Withdrawal coming soon")}
                className="rounded-xl glass px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {t("wallet.withdraw")}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top-up modal overlay */}
      {topupOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4"
          onClick={() => setTopupOpen(false)}
        >
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            className="glass-strong w-full max-w-md rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold mb-4">{t("wallet.topup")}</h2>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {QUICK_TOPUP.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCustomAmount(String(amt))}
                  className={`rounded-xl py-2 text-sm font-semibold border transition ${
                    customAmount === String(amt)
                      ? "bg-primary/15 border-primary text-primary"
                      : "glass border-border hover:border-primary/50"
                  }`}
                >
                  {fmtXOF(amt)}
                </button>
              ))}
            </div>

            <input
              type="number"
              placeholder={lang === "fr" ? "Montant personnalisé (XOF)" : "Custom amount (XOF)"}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-4"
            />

            {/* Payment methods */}
            <p className="text-xs text-muted-foreground mb-2">
              {lang === "fr" ? "Méthode de paiement" : "Payment method"}
            </p>
            <div className="space-y-2 mb-5">
              <button
                onClick={() => toast.info("Mobile Money integration coming soon")}
                className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="h-8 w-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Mobile Money</p>
                  <p className="text-xs text-muted-foreground">MTN, Moov, Airtel</p>
                </div>
              </button>
              <button
                onClick={() => toast.info("Card payment coming soon")}
                className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{lang === "fr" ? "Carte bancaire" : "Bank card"}</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                toast.success(lang === "fr" ? "Rechargement bientôt disponible" : "Top-up coming soon");
                setTopupOpen(false);
              }}
              className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
            >
              {customAmount ? `${t("wallet.topup")} ${fmtXOF(Number(customAmount))}` : t("wallet.topup")}
            </button>
          </motion.div>
        </motion.div>
      )}

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
