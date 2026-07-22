import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Tag, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
});

type PromoCode = Tables<"promo_codes">;

const promoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(24, "24 characters max")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
    type: z.enum(["percentage", "fixed", "free_delivery"]),
    value: z.coerce.number().nonnegative(),
    min_order_xof: z.coerce.number().nonnegative(),
    max_discount_xof: z.coerce.number().nonnegative().optional(),
    max_uses: z.coerce.number().int().positive().optional(),
    uses_per_user: z.coerce.number().int().positive(),
  })
  .refine((v) => v.type !== "percentage" || (v.value > 0 && v.value <= 100), {
    message: "Percentage must be between 1 and 100",
    path: ["value"],
  });
type PromoFormValues = z.infer<typeof promoSchema>;

function AdminPromotions() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      code: "",
      type: "percentage",
      value: 10,
      min_order_xof: 0,
      uses_per_user: 1,
    },
  });

  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPromo = useMutation({
    mutationFn: async (values: PromoFormValues) => {
      const { error } = await supabase.from("promo_codes").insert({
        code: values.code.toUpperCase(),
        type: values.type,
        value: values.value,
        min_order_xof: values.min_order_xof,
        max_discount_xof: values.max_discount_xof ?? null,
        max_uses: values.max_uses ?? null,
        uses_per_user: values.uses_per_user,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      form.reset({ code: "", type: "percentage", value: 10, min_order_xof: 0, uses_per_user: 1 });
      setShowForm(false);
      toast.success("Promo code created");
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "That code already exists" : e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("promo_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: ["admin-promo-codes"] });
      const previous = qc.getQueryData<PromoCode[]>(["admin-promo-codes"]);
      qc.setQueryData<PromoCode[]>(["admin-promo-codes"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, is_active } : p)),
      );
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) qc.setQueryData(["admin-promo-codes"], context.previous);
      toast.error("Failed to update");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["admin-promo-codes"] });
      const previous = qc.getQueryData<PromoCode[]>(["admin-promo-codes"]);
      qc.setQueryData<PromoCode[]>(["admin-promo-codes"], (old) => old?.filter((p) => p.id !== id));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) qc.setQueryData(["admin-promo-codes"], context.previous);
      toast.error("Failed to delete");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
  });

  const describeValue = (p: PromoCode) => {
    if (p.type === "percentage") return `${p.value}%${p.max_discount_xof ? ` (max ${fmtXOF(p.max_discount_xof)})` : ""}`;
    if (p.type === "fixed") return fmtXOF(p.value);
    return "Free delivery";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Promotions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage discount codes</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> New code
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-5"
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => createPromo.mutate(values))}
              className="grid grid-cols-2 md:grid-cols-3 gap-3"
            >
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="WELCOME10" className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="free_delivery">Free delivery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {form.watch("type") === "percentage" ? "Percent off" : "Amount off (XOF)"}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="number" disabled={form.watch("type") === "free_delivery"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_order_xof"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Min order (XOF)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_discount_xof"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Max discount (XOF, optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="No cap" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Total uses (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="Unlimited" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uses_per_user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Uses per customer</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-2 md:col-span-3 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl glass px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPromo.isPending}
                  className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
                >
                  {createPromo.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </Form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-16 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !promoCodes?.length ? (
        <div className="glass rounded-2xl py-10 text-center border-dashed">
          <Tag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No promo codes yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {promoCodes.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Tag className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-bold">{p.code}</p>
                <p className="text-xs text-muted-foreground">
                  {describeValue(p)} · min {fmtXOF(p.min_order_xof)} · {p.times_used}
                  {p.max_uses ? `/${p.max_uses}` : ""} used · {p.uses_per_user}/customer
                </p>
              </div>
              <Switch
                checked={p.is_active}
                onCheckedChange={(checked) => toggleActive.mutate({ id: p.id, is_active: checked })}
                aria-label={p.is_active ? "Deactivate code" : "Activate code"}
              />
              <button
                onClick={() => deletePromo.mutate(p.id)}
                aria-label={`Delete ${p.code}`}
                className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
