import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

export function SkeletonOrderCard() {
  return (
    <div className="glass rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-7 w-32" />
      <Shimmer className="h-3 w-16" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3">
      <Shimmer className="h-9 w-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-3.5 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
      </div>
      <Shimmer className="h-4 w-12" />
    </div>
  );
}

export function SkeletonChatItem() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Shimmer className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-3.5 w-24" />
        <Shimmer className="h-3 w-40" />
      </div>
      <Shimmer className="h-3 w-8" />
    </div>
  );
}

export function SkeletonProfileHeader() {
  return (
    <div className="flex items-center gap-4">
      <Shimmer className="h-16 w-16 rounded-2xl" />
      <div className="space-y-2">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-3 w-24" />
      </div>
    </div>
  );
}
