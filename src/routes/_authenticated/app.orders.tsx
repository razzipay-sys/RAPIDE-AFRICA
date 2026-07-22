import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { StatusBadge, StatusDot } from "@/components/rapide/StatusBadge";
import { EmptyState } from "@/components/rapide/EmptyState";
import { SkeletonOrderCard } from "@/components/rapide/SkeletonCard";
import {
  RIDER_ACTIVE_STATUSES,
  SUCCESSFUL_DELIVERY_STATUSES,
  ORDER_ALTERNATE_STATUSES,
} from "@/lib/order-lifecycle";

export const Route = createFileRoute("/_authenticated/app/orders")({
  component: OrdersPage,
});

type FilterType = "all" | "active" | "delivered" | "cancelled" | "issues";

const FILTER_STATUSES: Record<FilterType, string[]> = {
  all: [],
  active: ["pending", "searching_rider", ...RIDER_ACTIVE_STATUSES],
  delivered: SUCCESSFUL_DELIVERY_STATUSES,
  cancelled: ["cancelled"],
  issues: ORDER_ALTERNATE_STATUSES.filter((s) => s !== "cancelled"),
};

function OrdersPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered =
    filter === "all" ? orders : orders?.filter((o) => FILTER_STATUSES[filter].includes(o.status));

  const filterLabels: Record<FilterType, string> = {
    all: t("orders.filter.all"),
    active: t("orders.filter.active"),
    delivered: t("orders.filter.delivered"),
    cancelled: t("orders.filter.cancelled"),
    issues: t("orders.filter.issues"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t("orders.title")}</h1>
        <span className="text-sm text-muted-foreground">{orders?.length ?? 0}</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["all", "active", "delivered", "cancelled", "issues"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "bg-primary text-primary-foreground shadow-glow/50"
                : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {filterLabels[f]}
            {f === "active" && orders && (
              <span className="ml-1 opacity-70">
                {orders.filter((o) => FILTER_STATUSES.active.includes(o.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SkeletonOrderCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && filtered?.length === 0 && (
        <EmptyState
          icon={Package}
          title={t("orders.empty")}
          action={{ label: t("orders.send"), onClick: () => navigate({ to: "/app/book" }) }}
        />
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link
                to="/app/track/$orderId"
                params={{ orderId: o.id }}
                className="block glass rounded-2xl p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{o.code}</span>
                      <StatusDot status={o.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString(t("auto.engb"), {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm font-medium truncate">{o.pickup_address}</p>
                    </div>
                    <div className="flex items-start gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground truncate">{o.dropoff_address}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-sm">{fmtXOF(o.price_xof)}</p>
                    <StatusBadge status={o.status} className="mt-1 text-[10px]" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
