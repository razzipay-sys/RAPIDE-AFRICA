import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike, Search, CheckCircle2, XCircle, Clock, MapPin, Star,
  FileText, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtXOF } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/drivers")({
  component: AdminDrivers,
});

type DocStatus = "pending" | "approved" | "rejected";

const DOC_TYPE_LABELS: Record<string, string> = {
  license: "Driver's License",
  id_card: "National ID",
  vehicle_registration: "Vehicle Registration",
  insurance: "Insurance",
  profile_photo: "Profile Photo",
};

function statusBadge(status: DocStatus) {
  if (status === "approved") return "text-green-400 bg-green-400/10";
  if (status === "rejected") return "text-destructive bg-destructive/10";
  return "text-yellow-400 bg-yellow-400/10";
}

function AdminDrivers() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: riders, isLoading } = useQuery({
    queryKey: ["admin-riders", search],
    queryFn: async () => {
      let q = supabase
        .from("riders")
        .select(`
          id, user_id, vehicle_type, license_plate, is_online, rating, total_deliveries, current_lat, current_lng,
          profiles:user_id (full_name, phone, avatar_url),
          wallets:user_id (balance_xof),
          driver_documents (id, type, status, file_url, rejection_reason, created_at)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      const { data } = await q;
      return data ?? [];
    },
    staleTime: 30000,
  });

  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status, reason }: { docId: string; status: DocStatus; reason?: string }) => {
      const { error } = await supabase
        .from("driver_documents")
        .update({
          status,
          rejection_reason: reason ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "Document approved" : "Document rejected");
      setPendingRejectId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-riders"] });
    },
    onError: () => toast.error("Failed to update document"),
  });

  const filteredRiders = riders?.filter((r: any) => {
    if (!search.trim()) return true;
    const name = r.profiles?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const pendingDocCount = riders?.reduce((count: number, r: any) => {
    return count + (r.driver_documents?.filter((d: any) => d.status === "pending").length ?? 0);
  }, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Drivers</h1>
          <p className="text-sm text-muted-foreground">
            {riders?.length ?? 0} registered riders
            {pendingDocCount > 0 && (
              <span className="ml-2 text-yellow-400 font-medium">
                · {pendingDocCount} docs pending review
              </span>
            )}
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bike className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-input/40 border border-border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Driver list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRiders?.map((rider: any, idx: number) => {
            const profile = rider.profiles;
            const wallet = rider.wallets;
            const docs: any[] = rider.driver_documents ?? [];
            const pendingDocs = docs.filter((d) => d.status === "pending");
            const isExpanded = expandedId === rider.id;
            const initials = profile?.full_name
              ? profile.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
              : "R";

            return (
              <motion.div
                key={rider.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass rounded-2xl overflow-hidden"
              >
                {/* Rider header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rider.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-white/3 transition text-left"
                >
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {initials}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${rider.is_online ? "bg-green-400" : "bg-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{profile?.full_name ?? "—"}</p>
                      <div className="flex items-center gap-0.5 text-yellow-400">
                        <Star className="h-3 w-3 fill-yellow-400" />
                        <span className="text-xs">{Number(rider.rating ?? 5).toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {rider.vehicle_type ?? "—"} · {rider.license_plate ?? "no plate"} · {rider.total_deliveries ?? 0} deliveries
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmtXOF(wallet?.balance_xof ?? 0)}</p>
                    {pendingDocs.length > 0 && (
                      <span className="text-[10px] text-yellow-400 font-medium">
                        {pendingDocs.length} doc{pendingDocs.length > 1 ? "s" : ""} pending
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Expanded docs section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Documents ({docs.length}/{Object.keys(DOC_TYPE_LABELS).length})
                        </p>

                        {docs.length === 0 && (
                          <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                        )}

                        {docs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="text-xs font-medium">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(doc.status)}`}>
                                  {doc.status}
                                </span>
                              </div>
                              {doc.rejection_reason && (
                                <p className="text-[10px] text-destructive mt-0.5 pl-5">{doc.rejection_reason}</p>
                              )}
                            </div>

                            {/* View document */}
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline shrink-0"
                            >
                              View
                            </a>

                            {/* Approve / Reject actions */}
                            {doc.status === "pending" && (
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "approved" })}
                                  className="h-6 w-6 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 flex items-center justify-center transition"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setPendingRejectId(doc.id)}
                                  className="h-6 w-6 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition"
                                  title="Reject"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Reject reason input */}
                        {docs.some((d) => d.id === pendingRejectId) && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              placeholder="Rejection reason (optional)"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-full rounded-xl bg-input/40 border border-destructive/50 px-3 py-2 text-xs outline-none focus:border-destructive"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateDocStatus.mutate({ docId: pendingRejectId!, status: "rejected", reason: rejectReason || undefined })}
                                className="flex-1 rounded-xl bg-destructive/15 text-destructive py-1.5 text-xs font-semibold hover:bg-destructive/25 transition"
                              >
                                Confirm Reject
                              </button>
                              <button
                                onClick={() => { setPendingRejectId(null); setRejectReason(""); }}
                                className="h-7 w-7 rounded-xl glass flex items-center justify-center"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Location info */}
                        {rider.current_lat && rider.current_lng && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 pt-2 border-t border-border/50">
                            <MapPin className="h-3 w-3 text-green-400" />
                            <span className="text-green-400">Live</span>
                            {Number(rider.current_lat).toFixed(4)}, {Number(rider.current_lng).toFixed(4)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {!isLoading && !filteredRiders?.length && (
            <div className="glass rounded-2xl py-12 text-center">
              <Bike className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No drivers found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
