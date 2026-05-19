import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, MicOff, Mic } from "lucide-react";
import { useState } from "react";
import type { CallState } from "@/hooks/use-agora-call";

type Props = {
  callState: CallState;
  callDuration: number;
  otherName: string;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onEnd: () => Promise<void>;
};

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallOverlay({ callState, callDuration, otherName, onAccept, onDecline, onEnd }: Props) {
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (callState === "idle") return null;

  const handleAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const statusLabel =
    callState === "outgoing" ? "Calling…" :
    callState === "incoming" ? "Incoming voice call" :
    callState === "connected" ? formatDuration(callDuration) :
    "Call ended";

  return (
    <AnimatePresence>
      <motion.div
        key="call-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/97 backdrop-blur-2xl"
      >
        {/* Pulsing rings for ringing states */}
        {(callState === "outgoing" || callState === "incoming") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="h-56 w-56 rounded-full border border-primary/15"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute h-44 w-44 rounded-full border border-primary/25"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        )}

        {/* Avatar */}
        <div className="h-24 w-24 rounded-full bg-gradient-primary flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-glow mb-5 relative z-10">
          {otherName.charAt(0).toUpperCase()}
        </div>

        {/* Name + status */}
        <p className="text-xl font-semibold relative z-10">{otherName}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-10 relative z-10 tabular-nums">{statusLabel}</p>

        {/* Action buttons */}
        <div className="flex items-center gap-6 relative z-10">
          {callState === "incoming" && (
            <>
              <button
                disabled={busy}
                onClick={() => handleAction(onDecline)}
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition disabled:opacity-60"
              >
                <PhoneOff className="h-6 w-6 text-white" />
              </button>
              <button
                disabled={busy}
                onClick={() => handleAction(onAccept)}
                className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition disabled:opacity-60"
              >
                <Phone className="h-6 w-6 text-white" />
              </button>
            </>
          )}

          {callState === "connected" && (
            <>
              <button
                onClick={() => setMuted((m) => !m)}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition ${
                  muted ? "bg-muted-foreground/30 text-foreground" : "glass text-muted-foreground"
                }`}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                disabled={busy}
                onClick={() => handleAction(onEnd)}
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition disabled:opacity-60"
              >
                <PhoneOff className="h-6 w-6 text-white" />
              </button>
            </>
          )}

          {callState === "outgoing" && (
            <button
              disabled={busy}
              onClick={() => handleAction(onEnd)}
              className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition disabled:opacity-60"
            >
              <PhoneOff className="h-6 w-6 text-white" />
            </button>
          )}

          {callState === "ended" && (
            <div className="glass px-5 py-2 rounded-full text-sm text-muted-foreground">
              Call ended
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
