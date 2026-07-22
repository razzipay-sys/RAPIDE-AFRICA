import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AddressSearch } from "@/components/rapide/AddressSearch";
import { COMMISSION_RATE } from "@/lib/pricing";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app/errand")({
  component: AppErrand,
});

const errandSchema = z.object({
  description: z.string().trim().min(1, "Please describe what you need"),
  budget: z.coerce
    .number({ invalid_type_error: "Enter a valid budget amount" })
    .positive("Enter a valid budget amount"),
  dropoff: z.object({
    address: z.string().min(1, "Please select a drop-off location"),
    lat: z.number(),
    lng: z.number(),
  }),
});

type ErrandFormValues = z.infer<typeof errandSchema>;

function AppErrand() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const form = useForm<ErrandFormValues>({
    resolver: zodResolver(errandSchema),
    defaultValues: { description: "", budget: 0, dropoff: { address: "", lat: 0, lng: 0 } },
  });

  const requestErrand = useMutation({
    mutationFn: async (values: ErrandFormValues) => {
      const dropoff = values.dropoff;
      const priceXof = Math.round(values.budget) + 1500; // Budget + delivery fee
      const commissionXof = Math.round(priceXof * COMMISSION_RATE);
      const { error } = await supabase.from("orders").insert({
        customer_id: user!.id,
        delivery_type: "errand",
        pickup_address: "Any near market/store",
        pickup_lat: dropoff.lat, // Same general area
        pickup_lng: dropoff.lng,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_contact_name: user?.user_metadata?.full_name || "Me",
        dropoff_contact_phone: user?.phone || "",
        parcel_category: "other",
        parcel_notes: values.description,
        price_xof: priceXof,
        commission_xof: commissionXof,
        status: "searching_rider",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Errand requested!");
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      navigate({ to: "/app" });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to request errand"),
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate({ to: "/app" })} className="p-2 -ml-2 mr-2" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-lg">Buy For Me</h1>
      </header>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => requestErrand.mutate(values))}
          className="flex-1 flex flex-col"
        >
          <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
              <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900">Personal Shopper</h3>
                <p className="text-sm text-blue-700/80 mt-1 leading-snug">
                  Tell us what to buy, where to drop it off, and your max budget. A rider will buy it
                  and deliver it to you.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      What do you need?
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="e.g. 2kg of tomatoes from the market and some fresh bread"
                        className="w-full rounded-xl border border-slate-200 p-3 min-h-[100px] text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      Item Budget (XOF)
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="e.g. 5000"
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dropoff"
                render={({ field }) => (
                  <FormItem className="relative z-[60]">
                    <FormControl>
                      <AddressSearch
                        label="Drop-off Location"
                        icon="A"
                        placeholder="Where should we bring this?"
                        value={
                          field.value.address
                            ? { name: field.value.address, lat: field.value.lat, lng: field.value.lng }
                            : null
                        }
                        onChange={(r) => field.onChange({ address: r.name, lat: r.lat, lng: r.lng })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </main>

          <div className="p-4 bg-white border-t sticky bottom-0">
            <Button
              type="submit"
              className="w-full h-12 text-lg rounded-xl"
              disabled={requestErrand.isPending}
            >
              {requestErrand.isPending ? "Requesting..." : "Request Errand"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
