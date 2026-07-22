import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { EmptyState } from "@/components/rapide/EmptyState";
import { SkeletonChatItem } from "@/components/rapide/SkeletonCard";

export const Route = createFileRoute("/_authenticated/app/chat")({
  component: ChatListPage,
});

function timeAgo(iso: string | null | undefined, t: (k: string) => string, lang: string): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t("app.now");
  if (diff < 3600) return `${Math.floor(diff / 60)}${t("auto.m")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString(t("auto.engb"), { day: "numeric", month: "short" });
}

function ChatListPage() {
  const { user } = useAuth();
  const { t, lang } = useT();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          id, order_id, last_message_at, last_message_preview, unread_1, unread_2,
          participant_1, participant_2,
          order:orders(code, status)
        `,
        )
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        isP1: c.participant_1 === user!.id,
        otherId: c.participant_1 === user!.id ? c.participant_2 : c.participant_1,
        unread: c.participant_1 === user!.id ? c.unread_1 : c.unread_2,
      }));
    },
    enabled: !!user,
  });

  const otherIds = [...new Set(conversations?.map((c) => c.otherId) ?? [])];

  const { data: profiles } = useQuery({
    queryKey: ["conv-profiles", otherIds],
    queryFn: async () => {
      if (!otherIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", otherIds);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
    },
    enabled: otherIds.length > 0,
  });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 mb-4">
        <h1 className="font-display text-2xl font-bold">{t("chat.title")}</h1>
      </div>

      {isLoading && (
        <div className="space-y-0 divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <SkeletonChatItem key={i} />
          ))}
        </div>
      )}

      {!isLoading && conversations?.length === 0 && (
        <EmptyState icon={MessageCircle} title={t("chat.empty")} subtitle={t("chat.empty_sub")} />
      )}

      {!isLoading && conversations && conversations.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-border/60">
          {conversations.map((conv, idx) => {
            const profile = profiles?.[conv.otherId];
            const initials = (profile?.full_name ?? "?").charAt(0).toUpperCase();
            const order = conv.order as any;

            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link
                  to="/app/chat/$cid"
                  params={{ cid: conv.id }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center font-display font-bold text-primary-foreground">
                      {initials}
                    </div>
                    {conv.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                        {conv.unread > 9 ? "9+" : conv.unread}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-sm truncate ${conv.unread > 0 ? "font-semibold" : "font-medium"}`}
                      >
                        {profile?.full_name ?? `User ${conv.otherId.slice(0, 6)}`}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {timeAgo(conv.last_message_at, t, lang)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {order && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                          <Package className="h-2.5 w-2.5" />
                          {order.code}
                        </span>
                      )}
                      {conv.last_message_preview && (
                        <p
                          className={`text-xs truncate ${conv.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {order ? " · " : ""}
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
