import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  X,
} from "lucide-react";
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

// Rapide Mobile Money receiving numbers (update with real ops numbers before launch)
const MOMO_NUMBERS: { network: string; number: string; color: string }[] = [
  { network: "MTN MoMo",  number: "+229 01 20 00 00", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { network: "Moov Money", number: "+229 01 30 00 00", color: "bg-blue-500/15 text-blue-400 border-blue-500/30"   },
];

const QUICK_TOPUP = [1_000, 2_500, 5_000, 10_000, 25_000];

const TX_TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  topup:      { fr: "Rechargement", en: "Top-up" },
  payment:    { fr: "Paiement",     en: "Payment" },
  refund:     { fr: "Remboursement",en: "Refund"  },
  payout:     { fr: "Paiement coursier", en: "Rider payout" },
  bonus:      { fr: "Bonus",        en: "Bonus"   },
  commission: { fr: "Commission",   en: "Commission" },
};

// ── Generate a short human-readable reference for the transfer ──────────────
function genRef(): string {
  return "RPD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

type Step = "amount" | "instructions" | "done";

function WalletPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const qc = useQueryClient();

  // Top-up modal state
  const [open, setOpen]             = useState(false);
  const [step, setStep]             = useState<Step>("amount");
  const [amount, setAmount]         = useState("");
  const [ref, setRef]               = useState("");
  const [copied, setCopied]         = useState(false);

  // Withdrawal request state
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone]   = useState("");

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

  // ── Confirm top-up: log a pending topup transaction ────────────────────────
  // The amount will NOT be credited until admin verifies the MoMo receipt.
  // We record it so ops can match reference → wallet and credit manually.
  const confirmTopup = useMutation({
    mutationFn: async ({ amountXof, reference }: { amountXof: number; reference: string }) => {
      // Fetch wallet id
      const { data: w, error: wErr } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      if (wErr || !w) throw wErr ?? new Error("Wallet not found");

      // Insert pending top-up record (negative reference so ops can filter)
      const { error } = await supabase.from("wallet_transactions").insert({
        wallet_id:   w.id,
        user_id:     user!.id,
        type:        "topup",
        amount_xof:  amountXof,
        reference,
        description: lang === "fr"
          ? `Rechargement Mobile Money en attente — réf. ${reference}`
          : `Pending Mobile Money top-up — ref. ${reference}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-tx", user?.id] });
      setStep("done");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("errors.unexpected"));
      console.error("[wallet] topup record failed:", e);
    },
  });

  // ── Withdrawal request: create a support ticket ───────────────────────────
  const requestWithdrawal = useMutation({
    mutationFn: async ({ amountXof, phone }: { amountXof: number; phone: string }) => {
      const { error } = await supabase.from("support_tickets").insert({
        user_id:     user!.id,
        category:    "payment",
        subject:     t("wallet.req_subj") || (t("auto.withdrawalreque")),
        message:     lang === "fr"
          ? `L'utilisateur demande un retrait de ${fmtXOF(amountXof)} sur le numéro ${phone}.`
          : `User requests a withdrawal of ${fmtXOF(amountXof)} to number ${phone}.`,
        priority: "normal",
        status:   "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        t("wallet.req_sent") || (t("auto.withdrawalreque"))
      );
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawPhone("");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("errors.unexpected"));
      console.error("[wallet] withdrawal request failed:", e);
    },
  });

  const thisMonthTotal = txs
    ?.filter((tx) => {
      const d = new Date(tx.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear()
        && tx.type === "topup";
    })
    .reduce((s, tx) => s + Number(tx.amount_xof), 0) ?? 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openTopup() {
    const newRef = genRef();
    setRef(newRef);
    setAmount("");
    setStep("amount");
    setOpen(true);
  }

  function closeTopup() {
    setOpen(false);
    setTimeout(() => setStep("amount"), 300);
  }

  function handleAmountConfirm() {
    const n = Number(amount);
    if (!n || n < 500) {
      toast.error(t("wallet.min_amount") ?? (t("auto.minimumamountxo")));
      return;
    }
    setStep("instructions");
  }

  function handleTransferDone() {
    confirmTopup.mutate({ amountXof: Number(amount), reference: ref });
  }

  function copyRef() {
    navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">{t("wallet.title")}</h1>

      {/* ── Balance card ───────────────────────────────────────────────────── */}
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
              {t("wallet.this_month") ?? (t("auto.thismonth"))}{" "}
              <span className="text-green-400 font-medium">+{fmtXOF(thisMonthTotal)}</span>
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                id="wallet-topup-btn"
                onClick={openTopup}
                className="rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> {t("wallet.topup")}
              </button>
              <button
                id="wallet-withdraw-btn"
                onClick={() => setWithdrawOpen(true)}
                className="rounded-xl glass px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {t("wallet.withdraw")}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Top-up modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="topup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4"
            onClick={closeTopup}
          >
            <motion.div
              key="topup-sheet"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              className="glass-strong w-full max-w-md rounded-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-2xl font-bold">
                  {step === "done"
                    ? (t("wallet.topup_recorded") ?? (t("auto.topuprecorded")))
                    : t("wallet.topup_title")}
                </h3>
                <button onClick={closeTopup} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Step 1: Choose amount */}
              {step === "amount" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="grid grid-cols-5 gap-1.5 mb-4">
                    {QUICK_TOPUP.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(String(amt))}
                        className={`rounded-xl py-2 text-xs font-semibold border transition ${
                          amount === String(amt)
                            ? "bg-primary/15 border-primary text-primary"
                            : "glass border-border hover:border-primary/50"
                        }`}
                      >
                        {(amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1)}k
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    id="topup-amount-input"
                    placeholder={t("wallet.amount_xof") ?? (t("auto.amountinxof"))}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-4"
                  />

                  <button
                    id="topup-continue-btn"
                    onClick={handleAmountConfirm}
                    className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
                  >
                    {amount && Number(amount) >= 500
                      ? `${t("wallet.continue") ?? (t("auto.continue"))} — ${fmtXOF(Number(amount))}`
                      : (t("wallet.enter_amount") ?? (t("auto.enteranamount")))}
                  </button>
                </motion.div>
              )}

              {/* Step 2: Transfer instructions */}
              {step === "instructions" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("wallet.transfer_instr")}
                  </p>

                  {/* MoMo numbers */}
                  <div className="space-y-2">
                    {MOMO_NUMBERS.map((m) => (
                      <div key={m.network} className={`rounded-xl border p-3 flex items-center gap-3 ${m.color}`}>
                        <Smartphone className="h-4 w-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{m.network}</p>
                          <p className="text-sm font-mono font-bold">{m.number}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reference */}
                  <div className="glass rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("wallet.ref_required") ?? (t("auto.referencerequir"))}
                      </p>
                      <p className="font-mono font-bold text-primary text-lg tracking-wider">{ref}</p>
                    </div>
                    <button
                      id="copy-ref-btn"
                      onClick={copyRef}
                      className="h-9 w-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("auto.yourbalancewill")}
                  </p>

                  <button
                    id="topup-done-btn"
                    onClick={handleTransferDone}
                    disabled={confirmTopup.isPending}
                    className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
                  >
                    {confirmTopup.isPending
                      ? (t("wallet.recording") ?? (t("auto.recording")))
                      : (t("wallet.completed_transfer") ?? (t("auto.ivecompletedthe")))}
                  </button>
                </motion.div>
              )}

              {/* Step 3: Confirmation */}
              {step === "done" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-4"
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold mb-2">
                    {t("auto.requestrecorded")}
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("auto.reference")}{" "}
                    <span className="font-mono font-bold text-primary">{ref}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    {t("wallet.ref_help")}{" "}
                    <span className="font-semibold text-green-400">{fmtXOF(Number(amount))}</span>{" "}
                    {t("auto.afterverificati")}
                  </p>
                  <button
                    onClick={closeTopup}
                    className="w-full rounded-xl glass py-2.5 text-sm font-semibold"
                  >
                    {t("auto.close")}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Withdrawal modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {withdrawOpen && (
          <motion.div
            key="withdraw-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4"
            onClick={() => setWithdrawOpen(false)}
          >
            <motion.div
              key="withdraw-sheet"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              className="glass-strong w-full max-w-md rounded-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold">{t("wallet.withdraw")}</h2>
                <button onClick={() => setWithdrawOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {t("auto.entertheamounta")}
              </p>

              <div className="space-y-3 mb-5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("auto.amountxof")}
                  </p>
                  <input
                    id="withdraw-amount-input"
                    type="number"
                    placeholder="Ex: 5000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("auto.mobilemoneynumb")}
                  </p>
                  <input
                    id="withdraw-phone-input"
                    type="tel"
                    placeholder="+229 01 XX XX XX"
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              {wallet && Number(withdrawAmount) > wallet.balance_xof && (
                <p className="text-xs text-destructive mb-3">
                  {t("auto.insufficientbal")}
                </p>
              )}

              <button
                id="withdraw-submit-btn"
                disabled={
                  requestWithdrawal.isPending
                  || !withdrawAmount
                  || !withdrawPhone
                  || Number(withdrawAmount) < 500
                  || (!!wallet && Number(withdrawAmount) > wallet.balance_xof)
                }
                onClick={() =>
                  requestWithdrawal.mutate({
                    amountXof: Number(withdrawAmount),
                    phone: withdrawPhone,
                  })
                }
                className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                {requestWithdrawal.isPending
                  ? (t("auto.sending"))
                  : (t("auto.requestwithdraw"))}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transactions ───────────────────────────────────────────────────── */}
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
              const label  = TX_TYPE_LABEL[tx.type]?.[lang as "fr" | "en"] ?? tx.type;
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
                    <p className="text-sm font-medium truncate">{tx.description ?? label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleString(t("auto.engb"), {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {tx.reference && (
                        <span className="ml-2 font-mono opacity-60">#{tx.reference}</span>
                      )}
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
