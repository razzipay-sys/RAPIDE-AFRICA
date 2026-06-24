import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeadphonesIcon, Search, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/support/")({
  component: SupportDashboard,
});

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "text-yellow-400 bg-yellow-400/10",
  in_progress: "text-blue-400 bg-blue-400/10",
  resolved: "text-green-400 bg-green-400/10",
  closed: "text-muted-foreground bg-muted/30",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-yellow-400",
  high: "text-orange-400",
  urgent: "text-destructive",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function SupportDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets")
        .select(`
          id, subject, category, status, priority, created_at, updated_at,
          message,
          profiles:user_id (full_name, phone)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      return data ?? [];
    },
    staleTime: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success("Ticket updated");
    },
    onError: () => toast.error("Failed to update ticket"),
  });

  const filtered = tickets?.filter((t: any) => {
    if (!search.trim()) return true;
    return (
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const openCount = tickets?.filter((t: any) => t.status === "open").length ?? 0;
  const urgentCount = tickets?.filter((t: any) => t.priority === "urgent" || t.priority === "high").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">
            {openCount} open ticket{openCount !== 1 ? "s" : ""}
            {urgentCount > 0 && (
              <span className="ml-2 text-destructive font-medium">
                · {urgentCount} urgent/high
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl bg-input/40 border border-border pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary w-44"
          />
        </div>
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((ticket: any, idx: number) => {
            const isExpanded = expandedId === ticket.id;
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="glass rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full p-4 flex items-start gap-3 hover:bg-white/3 transition text-left"
                >
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {ticket.priority === "urgent" || ticket.priority === "high" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : ticket.status === "resolved" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{ticket.subject}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[ticket.status as TicketStatus]}`}>
                        {ticket.status.replace("_", " ")}
                      </span>
                      <span className={`text-[10px] font-medium ${PRIORITY_STYLES[ticket.priority ?? "low"]}`}>
                        {ticket.priority ?? "low"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.profiles?.full_name ?? "Unknown"} · {ticket.category ?? "general"} · {timeAgo(ticket.created_at)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 py-4 space-y-4">
                        {/* Message */}
                        <div className="glass rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1">User message</p>
                          <p className="text-sm">{ticket.message}</p>
                        </div>

                        {/* Status actions */}
                        <div className="flex gap-2 flex-wrap">
                          {(["open", "in_progress", "resolved", "closed"] as TicketStatus[])
                            .filter((s) => s !== ticket.status)
                            .map((s) => (
                              <button
                                key={s}
                                onClick={() => updateStatus.mutate({ id: ticket.id, status: s })}
                                disabled={updateStatus.isPending}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${STATUS_STYLES[s]} hover:opacity-80 disabled:opacity-50`}
                              >
                                Mark {s.replace("_", " ")}
                              </button>
                            ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {!isLoading && !filtered?.length && (
            <div className="glass rounded-2xl py-12 text-center">
              <HeadphonesIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tickets found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
