// Shape: System.
// The unknown-path system page, inside the shell (ui-gates.md G-STATE-3).

import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { SystemPage } from "./system-page";

export function NotFoundPage() {
  const { t } = useTranslation("system");
  return (
    <SystemPage
      isInShell
      title={t("notFound.title")}
      text={t("notFound.text")}
      actions={
        <Button asChild>
          <Link to="/">{t("action.start")}</Link>
        </Button>
      }
    />
  );
}
