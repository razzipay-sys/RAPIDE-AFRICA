// Centralized order-lifecycle state machine. Single source of truth for
// order status ordering, labels, and valid transitions across the app —
// nothing outside this file should compare against a raw status string
// literal for anything beyond a one-off. See CODE_AUDIT_ISSUES.txt Section
// 12 for the full design history and open decisions.
//
// This is a client-side *representation* of the lifecycle for UI purposes
// (progress bars, labels, filter groups, "what button comes next"). It is
// not the enforcement layer — the database's enforce_order_update_guard
// trigger and the claim_order/assign_order/accept_order/decline_order/
// complete_delivery/rate_delivery RPCs are the actual source of truth for
// what transitions are allowed; this module mirrors them so the UI doesn't
// duplicate that logic ad hoc in every file that touches order status.
import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// Reserved for a future payment-gateway integration — NOT in the database
// enum yet (see 20260720140000_order_lifecycle_step2_enum.sql's comment).
// Every order today is cash-on-delivery and enters the happy path already
// at "searching_rider"; these four are a documented placeholder for when a
// real gateway makes "waiting on payment" a real, distinct state instead of
// an instant pass-through.
export const RESERVED_FUTURE_STATUSES = [
  "draft",
  "submitted",
  "payment_pending",
  "confirmed",
] as const;

// The main sequence a delivery moves through, in order. Two real paths
// converge here: a rider self-claiming from the open queue skips straight
// from "searching_rider" to "rider_accepted" (claim = accept, atomic); a
// dispatcher-assigned order stops at "rider_assigned" until the rider
// explicitly accepts or declines. "near_destination" is set automatically
// from the rider's GPS pings, not a manual action.
export const ORDER_HAPPY_PATH: OrderStatus[] = [
  "searching_rider",
  "rider_assigned",
  "rider_accepted",
  "rider_arriving",
  "picked_up",
  "in_transit",
  "near_destination",
  "delivered",
  "completed",
];

// Terminal/alternate states — a delivery that leaves the happy path.
// 'failed' is retired (the old, pre-Step-1 catch-all) but kept here since
// historical rows may still carry it.
export const ORDER_ALTERNATE_STATUSES: OrderStatus[] = [
  "cancelled",
  "rejected",
  "expired",
  "failed_pickup",
  "failed_delivery",
  "returned",
  "failed",
];

// 'pending' is a dead value for new orders as of Step 1 (the
// advance_pending_orders trigger auto-advances it to 'searching_rider' on
// insert) but may still exist on old rows, so it needs a label.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting Rider",
  searching_rider: "Awaiting Rider",
  rider_assigned: "Rider Assigned",
  rider_accepted: "Rider Accepted",
  rider_arriving: "Heading to Pickup",
  picked_up: "Package Picked",
  in_transit: "In Transit",
  near_destination: "Near Destination",
  delivery_verification: "Delivery Verification",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
  failed_pickup: "Pickup Failed",
  failed_delivery: "Delivery Failed",
  returned: "Returned",
  failed: "Failed",
};

// Statuses during which a rider is actively assigned and working the
// delivery (as opposed to pre-assignment or terminal).
export const RIDER_ACTIVE_STATUSES: OrderStatus[] = [
  "rider_assigned",
  "rider_accepted",
  "rider_arriving",
  "picked_up",
  "in_transit",
  "near_destination",
];

// A delivery that reached a successful outcome — used for success-rate /
// completion-count metrics, which must count both since 'delivered' orders
// age into 'completed' over time (on rating, or after the 48h grace window).
export const SUCCESSFUL_DELIVERY_STATUSES: OrderStatus[] = ["delivered", "completed"];

export function isAlternateStatus(status: OrderStatus): boolean {
  return (ORDER_ALTERNATE_STATUSES as string[]).includes(status);
}

export function isSuccessfulDelivery(status: OrderStatus): boolean {
  return (SUCCESSFUL_DELIVERY_STATUSES as string[]).includes(status);
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === "completed" || isAlternateStatus(status);
}

// Position within the happy path, for progress bars / step trackers.
// Returns -1 for alternate/terminal-failure states (no meaningful position).
export function happyPathIndex(status: OrderStatus): number {
  return ORDER_HAPPY_PATH.indexOf(status);
}

// The rider-editable manual transitions — mirrors
// enforce_order_update_guard's allowed-transition list exactly. Excludes
// near_destination (geofence-triggered, not a button) and the
// delivered/completed transitions (RPC-only, OTP/rating-gated).
const RIDER_MANUAL_TRANSITIONS: ReadonlyArray<{
  from: OrderStatus;
  to: OrderStatus;
  label: string;
}> = [
  { from: "rider_accepted", to: "rider_arriving", label: "En Route to Pickup" },
  { from: "rider_arriving", to: "picked_up", label: "Picked Up ✓" },
  { from: "picked_up", to: "in_transit", label: "Start Delivery" },
];

export function nextRiderAction(
  status: OrderStatus,
): { label: string; status: OrderStatus } | null {
  const match = RIDER_MANUAL_TRANSITIONS.find((t) => t.from === status);
  return match ? { label: match.label, status: match.to } : null;
}

export function isRiderEditableTransition(from: OrderStatus, to: OrderStatus): boolean {
  return RIDER_MANUAL_TRANSITIONS.some((t) => t.from === from && t.to === to);
}
