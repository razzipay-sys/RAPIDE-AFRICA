import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText, CheckCircle2, Clock, XCircle, Upload, AlertCircle, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/documents")({
  component: RiderDocuments,
});

type DocType = "license" | "vehicle_registration" | "insurance" | "id_card" | "profile_photo";
type DocStatus = "pending" | "approved" | "rejected";

const DOC_META: Record<DocType, { label: string; description: string; icon: typeof FileText }> = {
  license: {
    label: "Driver's License",
    description: "Valid national driver's license (front & back)",
    icon: FileText,
  },
  id_card: {
    label: "National ID",
    description: "Government-issued identity document",
    icon: FileText,
  },
  vehicle_registration: {
    label: "Vehicle Registration",
    description: "Official vehicle registration certificate",
    icon: FileText,
  },
  insurance: {
    label: "Vehicle Insurance",
    description: "Current vehicle insurance certificate",
    icon: ShieldCheck,
  },
  profile_photo: {
    label: "Profile Photo",
    description: "Clear headshot photo (face visible)",
    icon: FileText,
  },
};

const DOC_TYPES = Object.keys(DOC_META) as DocType[];

function statusIcon(status?: DocStatus) {
  if (status === "approved") return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (status === "rejected") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-yellow-400" />;
  return <Upload className="h-5 w-5 text-muted-foreground" />;
}

function statusLabel(status?: DocStatus) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "pending") return "Under review";
  return "Not uploaded";
}

function statusColor(status?: DocStatus) {
  if (status === "approved") return "text-green-400 bg-green-400/10";
  if (status === "rejected") return "text-destructive bg-destructive/10";
  if (status === "pending") return "text-yellow-400 bg-yellow-400/10";
  return "text-muted-foreground bg-muted/30";
}

function RiderDocuments() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rider } = useQuery({
    queryKey: ["rider-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("riders").select("id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: docs, isLoading } = useQuery({
    queryKey: ["rider-docs", rider?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("rider_id", rider!.id);
      return data ?? [];
    },
    enabled: !!rider,
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ type, file }: { type: DocType; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `rider-docs/${rider!.id}/${type}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

      const existing = docs?.find((d) => d.type === type);
      if (existing) {
        const { error } = await supabase
          .from("driver_documents")
          .update({ file_url: urlData.publicUrl, status: "pending", rejection_reason: null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("driver_documents").insert({
          rider_id: rider!.id,
          type,
          file_url: urlData.publicUrl,
          status: "pending",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, { type }) => {
      toast.success(`${DOC_META[type].label} uploaded — under review`);
      qc.invalidateQueries({ queryKey: ["rider-docs"] });
    },
    onError: () => toast.error("Upload failed. Check file size and try again."),
  });

  type DocRow = NonNullable<typeof docs>[number];
  const docMap = Object.fromEntries(docs?.map((d) => [d.type, d]) ?? []) as Record<DocType, DocRow | undefined>;
  const approved = docs?.filter((d) => d.status === "approved").length ?? 0;
  const total = DOC_TYPES.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground">Upload required documents for verification</p>
      </div>

      {/* Progress */}
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Verification progress</span>
          <span className="text-sm font-bold text-primary">{approved}/{total}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(approved / total) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-primary"
          />
        </div>
        {approved === total && (
          <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All documents verified — you're fully approved
          </p>
        )}
        {approved < total && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {total - approved} document{total - approved > 1 ? "s" : ""} still needed
          </p>
        )}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {DOC_TYPES.map((type, idx) => {
            const doc = docMap[type];
            const meta = DOC_META[type];
            const Icon = meta.icon;
            const status = doc?.status as DocStatus | undefined;
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(status)}`}>
                        {statusLabel(status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                    {doc?.rejection_reason && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {doc.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">{statusIcon(status)}</div>
                </div>

                {(status !== "approved") && (
                  <label className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary cursor-pointer transition">
                    <Upload className="h-3.5 w-3.5" />
                    {status === "rejected" ? "Re-upload document" : "Upload file"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadDoc.mutate({ type, file });
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
