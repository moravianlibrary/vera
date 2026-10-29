// The service-unavailable system page, outside the shell with a retry action (ui-gates.md G-STATE-2).

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SystemPage } from "./system-page";

export function ServiceUnavailablePage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("system");
  return (
    <SystemPage
      title={t("unavailable.title")}
      text={t("unavailable.text")}
      actions={<Button onClick={onRetry}>{t("action.tryAgain")}</Button>}
    />
  );
}
