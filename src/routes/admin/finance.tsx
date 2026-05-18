import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";

export const Route = createFileRoute("/admin/finance")({
  component: AdminFinance,
});

function AdminFinance() {
  const { data: summary } = useQuery({
    queryKey: ["admin-finance-summary"],
    queryFn: async () => {
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("type, amount_xof, created_at")
        .order("created_at", { ascending: false });

      const now = new Date();
      const thisMonth = txns?.filter((t) => {
        const d = new Date(t.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }) ?? [];

      const lastMonth = txns?.filter((t) => {
        const d = new Date(t.created_at);
        const prev = new Date(now.getFullYear(), now.getMonth() - 1);
        return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
      }) ?? [];

      const gmv = thisMonth
        .filter((t) => t.type === "payment")
        .reduce((s, t) => s + Number(t.amount_xof), 0);

      const commissions = thisMonth
        .filter((t) => t.type === "commission")
        .reduce((s, t) => s + Number(t.amount_xof), 0);

      const payouts = thisMonth
        .filter((t) => t.type === "payout")
        .reduce((s, t) => s + Number(t.amount_xof), 0);

      const refunds = thisMonth
        .filter((t) => t.type === "refund")
        .reduce((s, t) => s + Number(t.amount_xof), 0);

      const lastGmv = lastMonth
        .filter((t) => t.type === "payment")
        .reduce((s, t) => s + Number(t.amount_xof), 0);

      return { gmv, commissions, payouts, refunds, lastGmv, txns };
    },
    refetchInterval: 60000,
  });

  // Build 30-day GMV chart
  const chartData = (() => {
    if (!summary?.txns) return [];
    const days: Record<string, { gmv: number; commission: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = { gmv: 0, commission: 0 };
    }
    summary.txns
      .filter((t) => ["payment", "commission"].includes(t.type))
      .forEach((t) => {
        const day = t.created_at.slice(0, 10);
        if (day in days) {
          if (t.type === "payment") days[day].gmv += Number(t.amount_xof) / 1000;
          if (t.type === "commission") days[day].commission += Number(t.amount_xof) / 1000;
        }
      });
    return Object.entries(days).map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      gmv: Math.round(vals.gmv),
      commission: Math.round(vals.commission),
    }));
  })();

  const growthPct =
    summary?.lastGmv && summary.lastGmv > 0
      ? (((summary.gmv - summary.lastGmv) / summary.lastGmv) * 100).toFixed(1)
      : null;

  const { data: allWallets } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_xof, user_id")
        .order("balance_xof", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const totalFloat = allWallets?.reduce((s, w) => s + Number(w.balance_xof), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Finance</h1>
        <p className="text-muted-foreground text-sm mt-1">This month's financial overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: DollarSign,
            label: "GMV",
            value: fmtXOF(summary?.gmv ?? 0),
            sub: growthPct ? `${growthPct}% vs last month` : undefined,
            trend: growthPct && Number(growthPct) > 0,
          },
          { icon: TrendingUp, label: "Commissions", value: fmtXOF(summary?.commissions ?? 0) },
          { icon: ArrowUpRight, label: "Payouts", value: fmtXOF(summary?.payouts ?? 0) },
          { icon: ArrowDownLeft, label: "Refunds", value: fmtXOF(summary?.refunds ?? 0) },
        ].map(({ icon: Icon, label, value, sub, trend }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5"
          >
            <Icon className="h-4 w-4 text-muted-foreground mb-3" />
            <p className="font-display text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            {sub && (
              <p className={`text-xs mt-1 font-medium ${trend ? "text-green-400" : "text-destructive"}`}>
                {sub}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* GMV + Commission 30-day chart */}
      <div className="glass rounded-2xl p-5">
        <p className="font-display font-bold mb-1">30-Day Revenue (KXOF)</p>
        <p className="text-xs text-muted-foreground mb-4">GMV vs Commission</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.72 0.2 45)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.72 0.2 45)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 35)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 35)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={6}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [`${v}K XOF`, name === "gmv" ? "GMV" : "Commission"]}
            />
            <Area type="monotone" dataKey="gmv" stroke="oklch(0.72 0.2 45)" fill="url(#gmvGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="commission" stroke="oklch(0.65 0.18 35)" fill="url(#commGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Platform float */}
      <section>
        <h2 className="font-display text-lg font-bold mb-1">Platform Float</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Total wallet balance across all users: <strong>{fmtXOF(totalFloat)}</strong>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">User ID</th>
                <th className="pb-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {allWallets?.map((w) => (
                <tr key={w.user_id} className="border-b border-border/50">
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{w.user_id.slice(0, 16)}…</td>
                  <td className="py-2.5 text-right font-medium">{fmtXOF(w.balance_xof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
