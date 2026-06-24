import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressSearch } from "@/components/rapide/AddressSearch";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/errand")({
  component: AppErrand,
});

function AppErrand() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [dropoff, setDropoff] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!description || !budget || !dropoff) {
      toast.error("Please fill all fields");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from("orders").insert({
        customer_id: user!.id,
        delivery_type: "errand",
        pickup_address: "Any near market/store",
        pickup_lat: dropoff.lat, // Same general area
        pickup_lng: dropoff.lng,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_contact_name: user?.full_name || "Me",
        dropoff_contact_phone: user?.phone || "",
        parcel_category: "other",
        parcel_notes: description,
        price_xof: parseInt(budget) + 1500, // Budget + delivery fee
        commission_xof: 300,
        status: "pending",
      });

      if (error) throw error;
      
      toast.success("Errand requested!");
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      navigate({ to: "/app" });
    } catch (e: any) {
      toast.error(e.message || "Failed to request errand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate({ to: "/app" })} className="p-2 -ml-2 mr-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-lg">Buy For Me</h1>
      </header>
      
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900">Personal Shopper</h3>
            <p className="text-sm text-blue-700/80 mt-1 leading-snug">
              Tell us what to buy, where to drop it off, and your max budget. A rider will buy it and deliver it to you.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">What do you need?</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 2kg of tomatoes from the market and some fresh bread"
              className="w-full rounded-xl border border-slate-200 p-3 min-h-[100px] text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Item Budget (XOF)</label>
            <input 
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 relative z-[60]">
            <AddressSearch 
              label="Drop-off Location"
              icon="A"
              placeholder="Where should we bring this?"
              value={dropoff ? { name: dropoff.address, lat: dropoff.lat, lng: dropoff.lng } : null}
              onChange={(r) => setDropoff({ address: r.name, lat: r.lat, lng: r.lng })}
            />
          </div>
        </div>
      </main>

      <div className="p-4 bg-white border-t sticky bottom-0">
        <Button 
          className="w-full h-12 text-lg rounded-xl"
          onClick={handleSubmit}
          disabled={loading || !description || !budget || !dropoff}
        >
          {loading ? "Requesting..." : "Request Errand"}
        </Button>
      </div>
    </div>
  );
}
