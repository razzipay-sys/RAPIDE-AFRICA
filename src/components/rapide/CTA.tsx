import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

export function CTA() {
  const { t } = useT();
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-surface to-background p-10 text-center shadow-elegant md:p-16"
        >
          <div className="absolute inset-0 bg-gradient-radial opacity-60" />
          <div className="relative">
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              {t("cta.title1")}{" "}
              <span className="text-gradient-primary">{t("cta.title2")}</span>
              {t("cta.title3")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{t("cta.desc")}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {/* Primary CTA → signup to start sending parcels */}
              <Link
                to="/signup"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.03] active:scale-[0.98]"
              >
                {t("cta.btn1")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              {/* Secondary CTA → mailto for sales inquiries */}
              <a
                href="mailto:sales@rapide.africa"
                className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3.5 text-sm font-semibold transition hover:bg-white/10 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                {t("cta.btn2")}
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
