import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type CallState = "idle" | "outgoing" | "incoming" | "connected" | "ended";

type CallSignal = {
  callType: "incoming" | "accepted" | "declined" | "ended";
  channelName: string;
  callerId: string;
  callerName: string;
  conversationId: string;
};

function uidFromUserId(userId: string): number {
  return (parseInt(userId.replace(/-/g, "").slice(0, 8), 16) % 999999999) + 1;
}

export function useAgoraCall(conversationId: string, otherId: string, otherName: string) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [incomingSignal, setIncomingSignal] = useState<CallSignal | null>(null);

  const rtcClientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const channelName = `call-${conversationId}`;

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    for (const track of localTracksRef.current) {
      try {
        track.stop();
        track.close();
      } catch {}
    }
    localTracksRef.current = [];
    if (rtcClientRef.current) {
      try {
        await rtcClientRef.current.leave();
      } catch {}
      rtcClientRef.current = null;
    }
  }, []);

  const sendSignal = useCallback(
    async (signal: CallSignal) => {
      if (!otherId) return;
      // notifications RLS only allows inserting rows for yourself, so a direct
      // insert here (for the *other* party) is always rejected — this RPC is a
      // SECURITY DEFINER function made for exactly this cross-user notify case.
      await supabase.rpc("create_notification", {
        p_user_id: otherId,
        p_type: "system",
        p_title: signal.callType === "incoming" ? `${signal.callerName} is calling` : "Call update",
        p_body: signal.callType,
        p_data: signal,
      });
    },
    [otherId],
  );

  const joinChannel = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const uid = uidFromUserId(user.id);

    const { data, error } = await supabase.functions.invoke("agora-token", {
      body: { channelName, uid },
    });
    if (error || !data?.token) {
      throw new Error(error?.message ?? "Failed to obtain call token");
    }

    const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    rtcClientRef.current = client;

    await client.join(data.appId, channelName, data.token, uid);

    const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localTracksRef.current = [micTrack];
    await client.publish([micTrack]);

    client.on("user-published", async (remoteUser: any, mediaType: "audio" | "video") => {
      await client.subscribe(remoteUser, mediaType);
      if (mediaType === "audio") remoteUser.audioTrack?.play();
    });
    client.on("user-left", () => {
      // Other side hung up
      cleanup().then(() => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2500);
      });
    });
  }, [user, channelName, cleanup]);

  const startCall = useCallback(async () => {
    if (!user) return;
    setCallState("outgoing");
    try {
      await joinChannel();
      await sendSignal({
        callType: "incoming",
        channelName,
        callerId: user.id,
        callerName: (user.user_metadata?.full_name as string | undefined) ?? "User",
        conversationId,
      });
    } catch (e) {
      await cleanup();
      setCallState("idle");
      throw e;
    }
  }, [user, joinChannel, sendSignal, cleanup, channelName, conversationId]);

  const acceptCall = useCallback(async () => {
    if (!incomingSignal || !user) return;
    setCallState("connected");
    try {
      await joinChannel();
      await sendSignal({ ...incomingSignal, callType: "accepted" });
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } catch (e) {
      await cleanup();
      setCallState("idle");
      throw e;
    }
  }, [incomingSignal, user, joinChannel, sendSignal, cleanup]);

  const declineCall = useCallback(async () => {
    if (!incomingSignal) return;
    await sendSignal({ ...incomingSignal, callType: "declined" });
    setIncomingSignal(null);
    setCallState("idle");
  }, [incomingSignal, sendSignal]);

  const endCall = useCallback(async () => {
    await sendSignal({
      callType: "ended",
      channelName,
      callerId: user?.id ?? "",
      callerName: otherName,
      conversationId,
    });
    await cleanup();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallState("ended");
    setTimeout(() => setCallState("idle"), 2500);
  }, [user, channelName, conversationId, otherName, sendSignal, cleanup]);

  // Listen for call signals via Realtime on the notifications table
  useEffect(() => {
    if (!user || !conversationId) return;
    const ch = supabase
      .channel(`call-signals-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any;
          if (n.type !== "system") return;
          const signal = n.data as CallSignal | undefined;
          if (!signal?.callType || signal.conversationId !== conversationId) return;

          if (signal.callType === "incoming") {
            setIncomingSignal(signal);
            setCallState("incoming");
          } else if (signal.callType === "accepted") {
            setCallState("connected");
            setCallDuration(0);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
          } else if (signal.callType === "declined" || signal.callType === "ended") {
            cleanup().then(() => {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              setIncomingSignal(null);
              setCallState("idle");
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, conversationId, cleanup]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  return {
    callState,
    callDuration,
    incomingSignal,
    startCall,
    acceptCall,
    declineCall,
    endCall,
  };
}
