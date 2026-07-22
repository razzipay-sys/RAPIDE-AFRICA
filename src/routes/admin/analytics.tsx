import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { isSuccessfulDelivery } from "@/lib/order-lifecycle";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

const COLORS = [
  "oklch(0.72 0.2 45)",
  "oklch(0.65 0.18 35)",
  "oklch(0.55 0.15 250)",
  "oklch(0.60 0.20 160)",
  "oklch(0.65 0.18 300)",
  "oklch(0.58 0.16 80)",
];

function AdminAnalytics() {
  const { data: orders } = useQuery({
    queryKey: ["admin-analytics-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "status, delivery_type, parcel_category, created_at, delivered_at, picked_up_at, price_xof",
        )
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // 30-day order volume
  const volumeData = (() => {
    if (!orders) return [];
    const days: Record<string, { orders: number; delivered: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = { orders: 0, delivered: 0 };
    }
    orders.forEach((o) => {
      const day = o.created_at.slice(0, 10);
      if (day in days) {
        days[day].orders++;
        if (isSuccessfulDelivery(o.status)) days[day].delivered++;
      }
    });
    return Object.entries(days).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      orders: v.orders,
      delivered: v.delivered,
    }));
  })();

  // Delivery type breakdown
  const deliveryTypeData = (() => {
    if (!orders) return [];
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.delivery_type] = (counts[o.delivery_type] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    }));
  })();

  // Category breakdown
  const categoryData = (() => {
    if (!orders) return [];
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.parcel_category] = (counts[o.parcel_category] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  })();

  // Delivery success rate by day-of-week
  const dowData = (() => {
    if (!orders) return [];
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = DAYS.map((d) => ({ day: d, total: 0, delivered: 0 }));
    orders.forEach((o) => {
      const dow = new Date(o.created_at).getDay();
      counts[dow].total++;
      if (isSuccessfulDelivery(o.status)) counts[dow].delivered++;
    });
    return counts.map((d) => ({
      ...d,
      rate: d.total > 0 ? Math.round((d.delivered / d.total) * 100) : 0,
    }));
  })();

  // Avg delivery time (minutes)
  const avgDeliveryTime = (() => {
    const completed = orders?.filter((o) => o.picked_up_at && o.delivered_at) ?? [];
    if (!completed.length) return null;
    const totalMs = completed.reduce((s, o) => {
      return s + (new Date(o.delivered_at!).getTime() - new Date(o.picked_up_at!).getTime());
    }, 0);
    return Math.round(totalMs / completed.length / 60000);
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform performance insights</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Orders", value: orders?.length ?? 0 },
          {
            label: "Delivery Rate",
            value: orders?.length
              ? `${Math.round((orders.filter((o) => isSuccessfulDelivery(o.status)).length / orders.length) * 100)}%`
              : "—",
          },
          { label: "Avg Transit Time", value: avgDeliveryTime ? `${avgDeliveryTime}m` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-2xl p-5 text-center">
            <p className="font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 30-day volume */}
      <div className="glass rounded-2xl p-5">
        <p className="font-display font-bold mb-4">Order Volume — Last 30 Days</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
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
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="orders"
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={false}
              name="Orders"
            />
            <Line
              type="monotone"
              dataKey="delivered"
              stroke={COLORS[3]}
              strokeWidth={2}
              dot={false}
              name="Delivered"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Delivery type pie */}
        <div className="glass rounded-2xl p-5">
          <p className="font-display font-bold mb-4">Delivery Types</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={deliveryTypeData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {deliveryTypeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Day of week success rate */}
        <div className="glass rounded-2xl p-5">
          <p className="font-display font-bold mb-4">Success Rate by Day</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData} barSize={24}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, "Success Rate"]}
              />
              <Bar dataKey="rate" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="glass rounded-2xl p-5">
        <p className="font-display font-bold mb-4">Parcel Categories</p>
        <div className="space-y-3">
          {categoryData.map(({ name, value }, i) => {
            const pct = orders?.length ? Math.round((value / orders.length) * 100) : 0;
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{name}</span>
                  <span className="text-muted-foreground">
                    {value} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
