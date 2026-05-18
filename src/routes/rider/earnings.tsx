import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, ArrowDownLeft, Star, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";

export const Route = createFileRoute("/rider/earnings")({
  component: RiderEarnings,
});

const TYPE_LABELS: Record<string, string> = {
  payout: "Delivery Payout",
  bonus: "Bonus",
  commission: "Commission",
  topup: "Top-up",
  payment: "Payment",
  refund: "Refund",
};

function RiderEarnings() {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance_xof").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: rider } = useQuery({
    queryKey: ["rider-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("riders").select("rating, total_deliveries").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions } = useQuery({
    queryKey: ["rider-transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Last 7 days chart data
  const chartData = (() => {
    if (!transactions) return [];
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    transactions
      .filter((t) => ["payout", "bonus"].includes(t.type))
      .forEach((t) => {
        const day = t.created_at.slice(0, 10);
        if (day in days) days[day] += Number(t.amount_xof);
      });
    return Object.entries(days).map(([date, amt]) => ({
      day: new Date(date).toLocaleDateString("fr-FR", { weekday: "short" }),
      amount: Math.round(amt / 1000),
    }));
  })();

  const thisMonth = transactions
    ?.filter((t) => {
      const now = new Date();
      const d = new Date(t.created_at);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear() &&
        ["payout", "bonus"].includes(t.type)
      );
    })
    .reduce((s, t) => s + Number(t.amount_xof), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Earnings</h1>
        <p className="text-sm text-muted-foreground">Your wallet & payout history</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-3 col-span-3"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Wallet Balance</p>
          <p className="font-display text-3xl font-bold text-gradient-primary mt-1">
            {fmtXOF(wallet?.balance_xof ?? 0)}
          </p>
        </motion.div>
        <div className="glass rounded-2xl p-3 text-center">
          <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="font-display text-base font-bold">{fmtXOF(thisMonth)}</p>
          <p className="text-[10px] text-muted-foreground">This month</p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <Star className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
          <p className="font-display text-base font-bold">{Number(rider?.rating ?? 5).toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Rating</p>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <Calendar className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="font-display text-base font-bold">{rider?.total_deliveries ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">Deliveries</p>
        </div>
      </div>

      {/* 7-day chart */}
      <div className="glass rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Last 7 Days (KXOF)
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barSize={20}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => [`${v}K XOF`, "Earnings"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="amount" fill="oklch(0.72 0.2 45)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction history */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Transaction History</h2>
        {transactions?.length === 0 ? (
          <p className="text-sm text-muted-foreground glass rounded-2xl p-4">No transactions yet.</p>
        ) : (
          <ul className="space-y-2">
            {transactions?.map((tx) => {
              const isCredit = ["payout", "bonus", "topup", "refund"].includes(tx.type);
              return (
                <li key={tx.id} className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isCredit ? "bg-green-400/10" : "bg-destructive/10"}`}>
                      <ArrowDownLeft className={`h-4 w-4 ${isCredit ? "text-green-400 rotate-180" : "text-destructive"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{TYPE_LABELS[tx.type] ?? tx.type}</p>
                      {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <p className={`font-display font-bold ${isCredit ? "text-green-400" : "text-destructive"}`}>
                    {isCredit ? "+" : "-"}{fmtXOF(Math.abs(Number(tx.amount_xof)))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
