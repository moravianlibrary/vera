// The forbidden system page, naming the view inside the shell (ui-gates.md G-STATE-3).

import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { SystemPage } from "./system-page";

export function ForbiddenPage({ page }: { page: string }) {
  const { t } = useTranslation("system");
  return (
    <SystemPage
      isInShell
      title={t("forbidden.title", { page })}
      text={t("forbidden.text")}
      actions={
        <Button asChild>
          <Link to="/">{t("action.start")}</Link>
        </Button>
      }
    />
  );
}
