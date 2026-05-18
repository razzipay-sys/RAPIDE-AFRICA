import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle, XCircle, Download, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/merchant/bulk")({
  component: MerchantBulk,
});

type Row = {
  pickup_address: string;
  dropoff_address: string;
  dropoff_contact_name: string;
  dropoff_contact_phone: string;
  parcel_category: string;
  price_xof: number;
  _valid: boolean;
  _errors: string[];
};

const REQUIRED_COLS = [
  "pickup_address",
  "dropoff_address",
  "dropoff_contact_name",
  "dropoff_contact_phone",
  "parcel_category",
  "price_xof",
] as const;

const TEMPLATE_CSV = `pickup_address,dropoff_address,dropoff_contact_name,dropoff_contact_phone,parcel_category,price_xof
"123 Rue du Marché, Cotonou","45 Avenue Steinmetz, Porto-Novo",Jean Dupont,+22961234567,document,1500
"Dantokpa Market, Cotonou","Star Hotel, Fidjrossè",Marie Kofi,+22997654321,food,2000
`;

function parseCSV(text: string): Row[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((v) => v.replace(/^"|"$/g, "").trim()) ?? [];
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    const errors: string[] = [];
    REQUIRED_COLS.forEach((col) => {
      if (!obj[col]) errors.push(`Missing: ${col}`);
    });
    const price = Number(obj.price_xof);
    if (isNaN(price) || price <= 0) errors.push("price_xof must be a positive number");
    const validCats = ["document", "food", "electronics", "clothing", "fragile", "other"];
    if (obj.parcel_category && !validCats.includes(obj.parcel_category)) {
      errors.push(`Invalid category: ${obj.parcel_category}`);
    }
    return {
      pickup_address: obj.pickup_address ?? "",
      dropoff_address: obj.dropoff_address ?? "",
      dropoff_contact_name: obj.dropoff_contact_name ?? "",
      dropoff_contact_phone: obj.dropoff_contact_phone ?? "",
      parcel_category: obj.parcel_category ?? "other",
      price_xof: isNaN(price) ? 0 : price,
      _valid: errors.length === 0,
      _errors: errors,
    };
  });
}

function MerchantBulk() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const valid = rows.filter((r) => r._valid);
      if (!valid.length) throw new Error("No valid rows");
      let success = 0;
      let failed = 0;
      // Batch inserts in chunks of 20
      for (let i = 0; i < valid.length; i += 20) {
        const chunk = valid.slice(i, i + 20).map((r) => ({
          customer_id: user.id,
          pickup_address: r.pickup_address,
          pickup_lat: 6.3676,   // Cotonou default – production would geocode
          pickup_lng: 2.4252,
          dropoff_address: r.dropoff_address,
          dropoff_lat: 6.3676,
          dropoff_lng: 2.4252,
          dropoff_contact_name: r.dropoff_contact_name,
          dropoff_contact_phone: r.dropoff_contact_phone,
          parcel_category: r.parcel_category as never,
          price_xof: r.price_xof,
          commission_xof: Math.round(r.price_xof * 0.15),
          status: "pending" as const,
        }));
        const { error } = await supabase.from("orders").insert(chunk);
        if (error) failed += chunk.length;
        else success += chunk.length;
      }
      return { success, failed };
    },
    onSuccess: (res) => {
      setResult(res);
      setRows([]);
      setFileName(null);
      toast.success(`${res.success} orders submitted${res.failed ? `, ${res.failed} failed` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Submission failed"),
  });

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;
  const totalCost = rows.filter((r) => r._valid).reduce((s, r) => s + r.price_xof, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Bulk Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload a CSV to submit hundreds of orders instantly</p>
      </div>

      {/* Template download */}
      <button
        onClick={() => {
          const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "rapide-bulk-template.csv";
          a.click();
        }}
        className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
      >
        <Download className="h-4 w-4" /> Download CSV template
      </button>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">{fileName ?? "Drop CSV here or click to browse"}</p>
        <p className="text-xs text-muted-foreground mt-1">Supports .csv files up to 10MB</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-green-400/30"
          >
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-sm font-medium">
              {result.success} orders submitted successfully
              {result.failed > 0 && ` · ${result.failed} failed`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
                <CheckCircle className="h-4 w-4" /> {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                  <XCircle className="h-4 w-4" /> {invalidCount} invalid
                </span>
              )}
            </div>
            <span className="text-sm font-medium">Total: {fmtXOF(totalCost)}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                  {["", "Pickup", "Dropoff", "Contact", "Category", "Price"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 ${!row._valid ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-2">
                      {row._valid ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <div title={row._errors.join(", ")}>
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{row.pickup_address}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{row.dropoff_address}</td>
                    <td className="px-3 py-2 truncate">{row.dropoff_contact_name}</td>
                    <td className="px-3 py-2 capitalize">{row.parcel_category}</td>
                    <td className="px-3 py-2 text-right">{fmtXOF(row.price_xof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing first 50 of {rows.length} rows
              </p>
            )}
          </div>

          <button
            onClick={() => submit.mutate()}
            disabled={validCount === 0 || submit.isPending}
            className="w-full rounded-xl bg-gradient-primary py-3 font-bold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {submit.isPending ? "Submitting..." : `Submit ${validCount} Orders`}
          </button>
        </div>
      )}
    </div>
  );
}
