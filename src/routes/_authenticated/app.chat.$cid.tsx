import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Languages, Phone, MoreVertical,
  Image, Mic, CheckCheck, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/chat/$cid")({
  component: ChatRoomPage,
});

type Message = {
  id: string;
  sender_id: string;
  type: string;
  content: string | null;
  media_url: string | null;
  is_read: boolean;
  translated_content: string | null;
  translate_from: string | null;
  created_at: string;
};

function groupByDate(messages: Message[], lang: string) {
  const groups: { label: string; messages: Message[] }[] = [];
  let last = "";
  for (const m of messages) {
    const d = new Date(m.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      weekday: "long", day: "numeric", month: "long",
    });
    if (d !== last) {
      groups.push({ label: d, messages: [] });
      last = d;
    }
    groups[groups.length - 1].messages.push(m);
  }
  return groups;
}

function ChatRoomPage() {
  const { cid } = Route.useParams();
  const { user } = useAuth();
  const { t, lang } = useT();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});

  const { data: conv } = useQuery({
    queryKey: ["conversation", cid],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, order_id, participant_1, participant_2, unread_1, unread_2, order:orders(code, status, pickup_address, dropoff_address)")
        .eq("id", cid)
        .single();
      return data;
    },
    enabled: !!cid,
  });

  const otherId = conv
    ? conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1
    : null;

  const { data: otherProfile } = useQuery({
    queryKey: ["profile", otherId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", otherId!).single();
      return data;
    },
    enabled: !!otherId,
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", cid],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", cid)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as Message[];
    },
    enabled: !!cid,
  });

  // Mark messages as read
  useEffect(() => {
    if (!messages?.length || !user) return;
    const unread = messages.filter((m) => m.sender_id !== user.id && !m.is_read);
    if (!unread.length) return;
    supabase
      .from("messages")
      .update({ is_read: true })
      .in("id", unread.map((m) => m.id))
      .then(() => {
        if (conv?.participant_1 === user.id) {
          supabase.from("conversations").update({ unread_1: 0 }).eq("id", cid);
        } else {
          supabase.from("conversations").update({ unread_2: 0 }).eq("id", cid);
        }
        qc.invalidateQueries({ queryKey: ["conversations"] });
      });
  }, [messages, user, cid, conv]);

  // Real-time subscription
  useEffect(() => {
    if (!cid) return;
    const ch = supabase
      .channel(`chat-${cid}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${cid}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["messages", cid] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cid, qc]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !user || !cid) return;
    const content = text.trim();
    setText("");
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: cid,
      sender_id: user.id,
      type: "text",
      content,
    });
    if (error) {
      toast.error("Failed to send message");
      setText(content);
    } else {
      // Update conversation preview
      const now = new Date().toISOString();
      const preview = content.slice(0, 80);
      if (conv?.participant_1 === user.id) {
        await supabase.from("conversations").update({
          last_message_at: now, last_message_preview: preview,
          unread_2: (conv?.unread_2 ?? 0) + 1,
        }).eq("id", cid);
      } else {
        await supabase.from("conversations").update({
          last_message_at: now, last_message_preview: preview,
          unread_1: (conv?.unread_1 ?? 0) + 1,
        }).eq("id", cid);
      }
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
    setSending(false);
  };

  const toggleTranslate = (msgId: string) => {
    setShowTranslated((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const order = conv?.order as any;
  const groups = groupByDate(messages ?? [], lang);
  const otherName = otherProfile?.full_name ?? `User ${otherId?.slice(0, 6) ?? "?"}`;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -mx-4 -mt-6">
      {/* Header */}
      <div className="glass-strong border-b border-border px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
        <Link to="/app/chat" className="glass h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center font-display font-bold text-sm text-primary-foreground shrink-0">
          {otherName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{otherName}</p>
          {order && (
            <p className="text-[11px] text-muted-foreground truncate">
              {t("chat.order")} #{order.code} · {order.pickup_address} → {order.dropoff_address}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            title={t("chat.call")}
            className="glass h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            onClick={() => toast.info("Voice calls coming soon")}
          >
            <Phone className="h-4 w-4" />
          </button>
          <button className="glass h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="text-sm text-muted-foreground">Loading messages…</span>
          </div>
        )}

        {!isLoading && groups.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-[11px] text-muted-foreground font-medium">{group.label}</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={msg.sender_id === user?.id}
                showTranslated={!!showTranslated[msg.id]}
                onToggleTranslate={() => toggleTranslate(msg.id)}
                lang={lang}
              />
            ))}
          </div>
        ))}

        {!isLoading && !messages?.length && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Start the conversation 👋</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="glass-strong border-t border-border px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <button
            title={t("chat.attach")}
            className="h-10 w-10 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition shrink-0"
            onClick={() => toast.info("Image sharing coming soon")}
          >
            <Image className="h-4 w-4" />
          </button>

          <div className="flex-1 glass rounded-2xl flex items-end gap-2 px-4 py-2.5 min-h-10">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t("chat.type")}
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground leading-5"
            />
          </div>

          <button
            title={t("chat.voice_note")}
            className="h-10 w-10 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition shrink-0"
            onClick={() => toast.info("Voice notes coming soon")}
          >
            <Mic className="h-4 w-4" />
          </button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow disabled:opacity-50 shrink-0"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg, isMine, showTranslated, onToggleTranslate, lang,
}: {
  msg: Message;
  isMine: boolean;
  showTranslated: boolean;
  onToggleTranslate: () => void;
  lang: string;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", {
    hour: "2-digit", minute: "2-digit",
  });

  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-muted-foreground glass px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  const displayContent = showTranslated && msg.translated_content
    ? msg.translated_content
    : msg.content;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex mb-1 ${isMine ? "justify-end" : "justify-start"}`}
      >
        <div className={`max-w-[78%] group`}>
          <div
            className={`rounded-2xl px-3.5 py-2.5 ${
              isMine
                ? "bg-gradient-primary text-primary-foreground rounded-br-md"
                : "glass-strong rounded-bl-md"
            }`}
          >
            <p className="text-sm leading-relaxed break-words">{displayContent}</p>

            {/* Translation toggle */}
            {(msg.translated_content || msg.translate_from) && (
              <button
                onClick={onToggleTranslate}
                className={`mt-1 flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition ${
                  isMine ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Languages className="h-2.5 w-2.5" />
                {showTranslated ? "Original" : "Translate"}
              </button>
            )}
          </div>

          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {isMine && (
              msg.is_read
                ? <CheckCheck className="h-3 w-3 text-primary" />
                : <Check className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
