import { Package } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Package className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold">Rapide</span>
            <span className="ml-3 text-xs text-muted-foreground">Cotonou, Bénin</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">{t("foot.privacy")}</a>
            <a href="#" className="hover:text-foreground">{t("foot.terms")}</a>
            <a href="#" className="hover:text-foreground">{t("foot.support")}</a>
            <a href="#" className="hover:text-foreground">{t("foot.careers")}</a>
          </div>
          <div className="text-xs text-muted-foreground">{t("foot.rights")}</div>
        </div>
      </div>
    </footer>
  );
}
