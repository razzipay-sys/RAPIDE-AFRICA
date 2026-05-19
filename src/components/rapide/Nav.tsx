import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Moon, Sun, Languages } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import rapideLogo from "@/assets/rapide-logo.jpg";

export function Nav() {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useT();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50 px-4 pt-4"
    >
      <nav className="glass-strong mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={rapideLogo} alt="Rapide" className="h-9 w-9 rounded-lg object-cover" />
          <span className="font-display text-lg font-bold tracking-tight">Rapide</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground transition hover:text-foreground">{t("nav.features")}</a>
          <a href="#network" className="text-sm text-muted-foreground transition hover:text-foreground">{t("nav.network")}</a>
          <a href="#business" className="text-sm text-muted-foreground transition hover:text-foreground">{t("nav.business")}</a>
          <a href="#riders" className="text-sm text-muted-foreground transition hover:text-foreground">{t("nav.riders")}</a>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            aria-label="Toggle language"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg glass px-2.5 text-xs font-semibold transition hover:bg-white/10"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang.toUpperCase()}
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg glass transition hover:bg-white/10"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/login" className="ml-1 hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground md:block">
            {t("nav.login")}
          </Link>
          <Link to="/signup" className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:scale-[1.02]">
            {t("nav.start")}
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
