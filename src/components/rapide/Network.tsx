import { motion } from "framer-motion";
import mapImg from "@/assets/map-glow.jpg?url";
import { useT } from "@/lib/i18n";

export function Network() {
  const { t } = useT();
  return (
    <section id="network" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-sm font-medium text-primary">{t("net.tag")}</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              {t("net.title1")}
              <br />
              <span className="text-gradient-primary">{t("net.title2")}</span>
            </h2>
            <p className="mt-5 text-muted-foreground">{t("net.desc")}</p>

            <div className="mt-8 space-y-4">
              {[
                { city: "Cotonou", load: 92 },
                { city: "Porto-Novo", load: 78 },
                { city: "Parakou", load: 54 },
                { city: "Abomey-Calavi", load: 86 },
              ].map((c, i) => (
                <motion.div
                  key={c.city}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-32 text-sm font-medium">{c.city}</div>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${c.load}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary shadow-glow"
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-muted-foreground">{c.load}%</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden rounded-3xl border border-border shadow-elegant"
          >
            <img
              src={mapImg}
              alt=""
              width={1600}
              height={1000}
              loading="lazy"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
