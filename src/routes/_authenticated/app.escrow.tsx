import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { fmtXOF } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/app/escrow")({
  component: AppEscrow,
});

function AppEscrow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void navigate({ to: "/app" });
  };

  const { data: escrows, isLoading } = useQuery({
    queryKey: ["my-escrows", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escrows")
        .select(
          "*, orders(code, dropoff_address), seller:profiles!escrows_seller_id_fkey(full_name)",
        )
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={handleBack} aria-label="Back" className="p-2 -ml-2 mr-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          Escrow Protection
        </h1>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <h3 className="font-medium text-green-900 text-sm">How it works</h3>
          <p className="text-xs text-green-800/80 mt-1">
            Your money is held safely until the item is delivered. If the item isn't delivered or
            doesn't match the description, you get a full refund.
          </p>
        </div>

        <h2 className="font-semibold text-slate-900 mt-2">Active Transactions</h2>

        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground text-sm">Loading...</div>
        ) : !escrows?.length ? (
          <div className="text-center p-8 bg-white border border-slate-100 rounded-2xl flex flex-col items-center">
            <ShieldCheck className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No escrow transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {escrows.map((e) => (
              <div
                key={e.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-lg">{fmtXOF(e.amount_xof)}</p>
                    <p className="text-xs text-muted-foreground">Order {(e.orders as any)?.code}</p>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                      e.status === "held"
                        ? "bg-amber-100 text-amber-700"
                        : e.status === "released"
                          ? "bg-green-100 text-green-700"
                          : e.status === "disputed"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {e.status === "held" && <Clock className="h-3 w-3" />}
                    {e.status === "released" && <CheckCircle className="h-3 w-3" />}
                    {e.status === "disputed" && <AlertTriangle className="h-3 w-3" />}
                    {e.status}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Seller</p>
                    <p className="font-medium truncate">
                      {(e.seller as any)?.full_name || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="font-medium truncate">
                      {(e.orders as any)?.dropoff_address || "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
