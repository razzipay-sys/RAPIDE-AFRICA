import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import parcels from "@/assets/parcels-3d.jpg?url";
import { useT } from "@/lib/i18n";

export function Audiences() {
  const { t } = useT();

  const cards = [
    {
      id: "business",
      tag: t("aud.b.tag"),
      title: t("aud.b.t"),
      desc: t("aud.b.d"),
      cta: t("aud.b.c"),
      to: "/signup" as const,
    },
    {
      id: "riders",
      tag: t("aud.r.tag"),
      title: t("aud.r.t"),
      desc: t("aud.r.d"),
      cta: t("aud.r.c"),
      to: "/rider-signup" as const,
    },
  ];

  return (
    <section id="riders" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {cards.map((c, i) => (
            <motion.div
              key={c.id}
              id={c.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <Link
                to={c.to}
                className="group relative flex flex-col overflow-hidden rounded-3xl glass p-8 transition hover:border-primary/40 md:p-10 h-full"
              >
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl opacity-0 transition duration-500 group-hover:opacity-100" />
                {i === 0 && (
                  <img
                    src={parcels}
                    alt=""
                    width={400}
                    height={400}
                    loading="lazy"
                    className="absolute -right-10 -bottom-10 h-56 w-56 object-cover opacity-40 mix-blend-screen"
                  />
                )}
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {c.tag}
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-bold leading-tight md:text-3xl">
                    {c.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground flex-1">
                    {c.desc}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {c.cta}
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
