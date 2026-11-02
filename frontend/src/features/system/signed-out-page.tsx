// Shape: System.
// The signed-out system page, outside the shell (ui-gates.md G-STATE-2).

import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { SystemPage } from "./system-page";

export function SignedOutPage() {
  const { t } = useTranslation("system");
  return (
    <SystemPage
      title={t("signedOut.title")}
      text={t("signedOut.text")}
      actions={
        <Button asChild>
          <Link to="/login">{t("signedOut.action")}</Link>
        </Button>
      }
    />
  );
}
