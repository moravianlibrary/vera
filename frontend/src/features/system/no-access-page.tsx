// The no-access system page, inside the shell (ui-gates.md G-STATE-3).

import { useTranslation } from "react-i18next";
import { SystemPage } from "./system-page";

export function NoAccessPage() {
  const { t } = useTranslation("system");
  return <SystemPage isInShell title={t("noAccess.title")} text={t("noAccess.text")} />;
}
