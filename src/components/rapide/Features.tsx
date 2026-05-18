import { motion } from "framer-motion";
import { Package, MapPin, Clock, Shield, Wallet, Globe2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Features() {
  const { t } = useT();
  const features = [
    { icon: Package, title: t("feat.1.t"), desc: t("feat.1.d") },
    { icon: MapPin, title: t("feat.2.t"), desc: t("feat.2.d") },
    { icon: Clock, title: t("feat.3.t"), desc: t("feat.3.d") },
    { icon: Shield, title: t("feat.4.t"), desc: t("feat.4.d") },
    { icon: Wallet, title: t("feat.5.t"), desc: t("feat.5.d") },
    { icon: Globe2, title: t("feat.6.t"), desc: t("feat.6.d") },
  ];
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-sm font-medium text-primary">{t("feat.tag")}</div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">{t("feat.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("feat.desc")}</p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl glass p-6 transition hover:border-primary/30"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition group-hover:opacity-100" />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
