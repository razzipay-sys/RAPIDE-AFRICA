import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:          { label: "Pending",        className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  searching_rider:  { label: "Finding rider",  className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  rider_assigned:   { label: "Rider assigned", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  rider_arriving:   { label: "En route",       className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
  picked_up:        { label: "Picked up",      className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  in_transit:       { label: "In transit",     className: "bg-primary/15 text-primary border-primary/20" },
  delivered:        { label: "Delivered",      className: "bg-green-500/15 text-green-400 border-green-500/20" },
  cancelled:        { label: "Cancelled",      className: "bg-destructive/15 text-destructive border-destructive/20" },
  failed:           { label: "Failed",         className: "bg-destructive/15 text-destructive border-destructive/20" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
      cfg.className,
      className,
    )}>
      {cfg.label}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-400",
    searching_rider: "bg-blue-400 animate-pulse",
    rider_assigned: "bg-blue-400",
    rider_arriving: "bg-indigo-400 animate-pulse",
    picked_up: "bg-orange-400",
    in_transit: "bg-primary animate-pulse",
    delivered: "bg-green-400",
    cancelled: "bg-destructive",
    failed: "bg-destructive",
  };
  return (
    <span className={cn("h-2 w-2 rounded-full shrink-0", colors[status] ?? "bg-muted-foreground")} />
  );
}
