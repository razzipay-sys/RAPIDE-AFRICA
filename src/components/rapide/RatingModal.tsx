import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X } from "lucide-react";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment?: string) => void;
  pending?: boolean;
};

const LABELS: Record<string, { fr: string; en: string }> = {
  "1": { fr: "Mauvais", en: "Poor" },
  "2": { fr: "Passable", en: "Fair" },
  "3": { fr: "Bien", en: "Good" },
  "4": { fr: "Très bien", en: "Great" },
  "5": { fr: "Excellent !", en: "Excellent!" },
};

export function RatingModal({ open, onClose, onSubmit, pending }: Props) {
  const { t, lang } = useT();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const active = hover || rating;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-safe-bottom pb-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="glass-strong w-full max-w-md rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-bold">{t("rating.title")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("rating.subtitle")}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="h-8 w-8 rounded-xl glass flex items-center justify-center shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-3 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.85 }}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                  aria-label={`${s} star${s > 1 ? "s" : ""}`}
                  aria-pressed={rating === s}
                  className="transition-transform"
                >
                  <Star
                    className={`h-11 w-11 transition-all duration-150 ${
                      s <= active
                        ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                        : "text-muted-foreground/25"
                    }`}
                  />
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {active > 0 && (
                <motion.p
                  key={active}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-base font-semibold text-yellow-400 mb-4"
                >
                  {LABELS[String(active)]?.[lang as "fr" | "en"]}
                </motion.p>
              )}
            </AnimatePresence>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("rating.comment")}
              rows={2}
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-3 text-sm outline-none focus:border-primary resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl glass py-3 text-sm font-semibold"
              >
                {t("rating.skip")}
              </button>
              <button
                onClick={() => rating > 0 && onSubmit(rating, comment || undefined)}
                disabled={!rating || pending}
                className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40 transition"
              >
                {pending ? "…" : t("rating.submit")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
