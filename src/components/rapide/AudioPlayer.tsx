import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const BAR_HEIGHTS = [5, 9, 14, 8, 16, 11, 18, 9, 7, 13, 17, 10, 12, 7, 15, 13, 9, 11, 7, 5];

type Props = {
  src: string;
  isMine: boolean;
};

function formatTime(secs: number) {
  if (!isFinite(secs) || isNaN(secs) || secs <= 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioPlayer({ src, isMine }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const progress = duration > 0 ? current / duration : 0;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[180px] max-w-[220px] ${isMine ? "text-primary-foreground" : ""}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />

      <button
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition ${
          isMine
            ? "bg-white/25 hover:bg-white/35 text-primary-foreground"
            : "bg-primary/15 hover:bg-primary/25 text-foreground"
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      {/* Waveform */}
      <div className="flex-1 flex items-center gap-[2px] h-8">
        {BAR_HEIGHTS.map((h, i) => {
          const filled = i / BAR_HEIGHTS.length <= progress;
          return (
            <div
              key={i}
              style={{ height: `${h}px` }}
              className={`flex-1 rounded-full transition-colors ${
                filled
                  ? isMine
                    ? "bg-white/85"
                    : "bg-primary"
                  : isMine
                    ? "bg-white/30"
                    : "bg-border"
              }`}
            />
          );
        })}
      </div>

      <span
        className={`text-[10px] tabular-nums shrink-0 ${isMine ? "opacity-80" : "text-muted-foreground"}`}
      >
        {formatTime(playing ? current : duration)}
      </span>
    </div>
  );
}
