import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

type Props = {
  disabled?: boolean;
  onVoiceNote: (blob: Blob) => void;
};

function formatSecs(secs: number) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({ disabled, onVoiceNote }: Props) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    if (!window.MediaRecorder) {
      toast.error("Voice notes are not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 0) onVoiceNote(blob);
        setDuration(0);
      };

      mr.start(250);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-red-400 font-medium tabular-nums min-w-[32px]">
          {formatSecs(duration)}
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={stopRecording}
          aria-label="Stop recording"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0"
        >
          <Square className="h-4 w-4 text-white fill-white" />
        </motion.button>
      </div>
    );
  }

  return (
    <button
      title="Voice note"
      aria-label="Record voice note"
      className="h-10 w-10 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition shrink-0"
      onClick={startRecording}
      disabled={disabled}
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
