import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-lifecycle";

const STATUS_CLASSNAME: Record<OrderStatus, string> = {
  pending: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  searching_rider: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  rider_assigned: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  rider_accepted: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  rider_arriving: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  picked_up: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  in_transit: "bg-primary/15 text-primary border-primary/20",
  near_destination: "bg-primary/15 text-primary border-primary/20",
  delivery_verification: "bg-primary/15 text-primary border-primary/20",
  delivered: "bg-green-500/15 text-green-400 border-green-500/20",
  completed: "bg-green-500/15 text-green-400 border-green-500/20",
  cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/20",
  failed_pickup: "bg-destructive/15 text-destructive border-destructive/20",
  failed_delivery: "bg-destructive/15 text-destructive border-destructive/20",
  returned: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  expired: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
  const statusClassName = STATUS_CLASSNAME[status as OrderStatus] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        statusClassName,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-blue-400 animate-pulse",
    searching_rider: "bg-blue-400 animate-pulse",
    rider_assigned: "bg-blue-400",
    rider_accepted: "bg-blue-400",
    rider_arriving: "bg-indigo-400 animate-pulse",
    picked_up: "bg-orange-400",
    in_transit: "bg-primary animate-pulse",
    near_destination: "bg-primary animate-pulse",
    delivery_verification: "bg-primary animate-pulse",
    delivered: "bg-green-400",
    completed: "bg-green-400",
    cancelled: "bg-destructive",
    failed: "bg-destructive",
    rejected: "bg-destructive",
    failed_pickup: "bg-destructive",
    failed_delivery: "bg-destructive",
    returned: "bg-amber-400",
    expired: "bg-muted-foreground",
  };
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", colors[status] ?? "bg-muted-foreground")}
    />
  );
}
