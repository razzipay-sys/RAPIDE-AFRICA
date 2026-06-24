import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell, Package, MessageCircle, Wallet, Tag, AlertCircle, CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { EmptyState } from "@/components/rapide/EmptyState";
import { SkeletonListItem } from "@/components/rapide/SkeletonCard";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  component: NotificationsPage,
});

const TYPE_ICON = {
  order_update: Package,
  chat_message: MessageCircle,
  payment: Wallet,
  promotion: Tag,
  system: Bell,
  kyc_update: AlertCircle,
} as const;

const TYPE_COLOR = {
  order_update: "bg-primary/15 text-primary",
  chat_message: "bg-blue-500/15 text-blue-400",
  payment: "bg-green-500/15 text-green-400",
  promotion: "bg-purple-500/15 text-purple-400",
  system: "bg-muted/50 text-muted-foreground",
  kyc_update: "bg-yellow-500/15 text-yellow-400",
} as const;

function formatTime(iso: string, t: (k: string) => string, lang: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return t("app.now");
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return t("app.min_ago").replace("{val}", m.toString());
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return t("app.h_ago").replace("{val}", h.toString());
  }
  return new Date(iso).toLocaleDateString(t("auto.engb"), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationsPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notif-unread"] });
  };

  const unread = notifications?.filter((n) => !n.is_read) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("notif.title")}</h1>
          {unread.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread.length} {t("chat.unread")}
            </p>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-1.5 text-xs text-primary font-medium"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t("notif.mark_all")}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <SkeletonListItem key={i} />)}
        </div>
      )}

      {!isLoading && !notifications?.length && (
        <EmptyState
          icon={Bell}
          title={t("notif.empty")}
          subtitle={t("notif.empty_sub")}
        />
      )}

      {!isLoading && notifications && notifications.length > 0 && (
        <div className="space-y-1">
          {notifications.map((notif, idx) => {
            const Icon = TYPE_ICON[notif.type as keyof typeof TYPE_ICON] ?? Bell;
            const colorClass = TYPE_COLOR[notif.type as keyof typeof TYPE_COLOR] ?? TYPE_COLOR.system;

            const content = (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => !notif.is_read && markRead(notif.id)}
                className={`glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer hover:bg-white/5 transition ${!notif.is_read ? "border border-primary/20" : ""}`}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!notif.is_read ? "font-semibold" : "font-medium"}`}>
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatTime(notif.created_at, t, lang)}
                    </span>
                  </div>
                  {notif.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                  )}
                </div>
                {!notif.is_read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </motion.div>
            );

            return notif.action_url ? (
              <Link key={notif.id} to={notif.action_url as any}>{content}</Link>
            ) : (
              <div key={notif.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
