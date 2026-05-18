import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { Package } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("customer_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">{t("orders.title")}</h1>
      {isLoading && <p className="text-sm text-muted-foreground">{t("orders.loading")}</p>}
      {!isLoading && orders?.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("orders.empty")}</p>
          <Link to="/app/book" className="mt-4 inline-block rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
            {t("orders.send")}
          </Link>
        </div>
      )}
      <ul className="space-y-2">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link to="/app/track/$orderId" params={{ orderId: o.id }} className="block glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{o.code} · {new Date(o.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")}</p>
                  <p className="text-sm font-medium truncate">{o.pickup_address} → {o.dropoff_address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtXOF(o.price_xof)}</p>
                </div>
                <span className="text-xs rounded-full glass-strong px-2.5 py-1 capitalize">{o.status}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
