import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { SUCCESSFUL_DELIVERY_STATUSES } from "@/lib/order-lifecycle";

export const Route = createFileRoute("/merchant/invoicing")({
  component: MerchantInvoicing,
});

type Invoice = {
  period: string; // "2025-05"
  label: string; // "May 2025"
  orders: number;
  subtotal: number;
  tax: number;
  total: number;
};

function buildInvoices(orders: { price_xof: number; created_at: string }[]): Invoice[] {
  const months: Record<string, { orders: number; subtotal: number }> = {};
  orders.forEach((o) => {
    const period = o.created_at.slice(0, 7); // "2025-05"
    if (!months[period]) months[period] = { orders: 0, subtotal: 0 };
    months[period].orders++;
    months[period].subtotal += Number(o.price_xof);
  });
  return Object.entries(months)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, data]) => {
      const [year, month] = period.split("-").map(Number);
      const label = new Date(year, month - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const tax = Math.round(data.subtotal * 0.18); // 18% VAT (Bénin TVA)
      return {
        period,
        label,
        orders: data.orders,
        subtotal: data.subtotal,
        tax,
        total: data.subtotal + tax,
      };
    });
}

function generateInvoiceHTML(inv: Invoice, merchantName: string, invoiceNo: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${invoiceNo}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a2e; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .logo { font-size: 24px; font-weight: 800; color: #e8660a; }
  .meta { text-align: right; font-size: 13px; color: #666; }
  h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #f0f0f0; font-size: 11px; text-transform: uppercase; color: #888; }
  td { padding: 12px; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
  .totals { margin-left: auto; width: 260px; }
  .totals td { padding: 8px 12px; }
  .totals .grand { font-weight: 700; font-size: 16px; background: #fef3ec; }
  .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">⚡ Rapide</div>
    <div style="font-size:12px;color:#888;margin-top:4px">Livraison nouvelle génération au Bénin<br>support@rapide.bj</div>
  </div>
  <div class="meta">
    <div style="font-size:18px;font-weight:700;color:#e8660a">INVOICE</div>
    <div>#${invoiceNo}</div>
    <div style="margin-top:8px">Issued: ${new Date().toLocaleDateString("en-GB")}</div>
  </div>
</div>
<div style="display:flex;justify-content:space-between;margin-bottom:32px">
  <div>
    <div style="font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px">Bill To</div>
    <div style="font-weight:600">${merchantName}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px">Period</div>
    <div style="font-weight:600">${inv.label}</div>
  </div>
</div>
<table>
  <thead><tr><th>Description</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr><td>Delivery services — ${inv.label}</td><td>${inv.orders} orders</td><td style="text-align:right">${fmtXOF(inv.subtotal)}</td></tr>
  </tbody>
</table>
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${fmtXOF(inv.subtotal)}</td></tr>
  <tr><td>TVA (18%)</td><td style="text-align:right">${fmtXOF(inv.tax)}</td></tr>
  <tr class="grand"><td><strong>Total</strong></td><td style="text-align:right"><strong>${fmtXOF(inv.total)}</strong></td></tr>
</table>
<div class="footer">Rapide — Cotonou, Bénin · RCCM: [your number] · IFU: [your number]<br>Thank you for shipping with Rapide</div>
</body></html>`;
}

function MerchantInvoicing() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["merchant-all-orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("price_xof, created_at, status")
        .eq("customer_id", user!.id)
        .in("status", SUCCESSFUL_DELIVERY_STATUSES)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const invoices = orders ? buildInvoices(orders) : [];

  const downloadInvoice = (inv: Invoice) => {
    const no = `RPD-${inv.period.replace("-", "")}-${(user?.id ?? "000").slice(0, 6).toUpperCase()}`;
    const html = generateInvoiceHTML(inv, profile?.full_name ?? "Merchant", no);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Invoicing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monthly invoices for all delivered orders (TVA 18% included)
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Invoices appear once you have delivered orders
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const no = `RPD-${inv.period.replace("-", "")}-${(user?.id ?? "000").slice(0, 6).toUpperCase()}`;
            const isOpen = expanded === inv.period;
            return (
              <motion.div
                key={inv.period}
                layout
                className="glass-strong rounded-2xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : inv.period)}
                  className="w-full px-5 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{inv.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.orders} orders · #{no}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display font-bold text-sm">{fmtXOF(inv.total)}</p>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/50"
                  >
                    <div className="px-5 py-4 space-y-3">
                      <table className="w-full text-sm">
                        <tbody>
                          {[
                            ["Delivery services", fmtXOF(inv.subtotal)],
                            ["TVA (18%)", fmtXOF(inv.tax)],
                            ["Total", fmtXOF(inv.total)],
                          ].map(([label, val]) => (
                            <tr
                              key={label}
                              className="border-b border-border/50 last:border-0 last:font-bold"
                            >
                              <td className="py-2 text-muted-foreground">{label}</td>
                              <td className="py-2 text-right">{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        onClick={() => downloadInvoice(inv)}
                        className="flex items-center gap-2 w-full justify-center rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
                      >
                        <Download className="h-4 w-4" />
                        Download / Print Invoice
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
