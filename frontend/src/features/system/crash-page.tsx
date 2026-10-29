// The router's crash system page, with a short reference for whoever looks after VERA.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { SystemPage } from "./system-page";

export function CrashPage() {
  const error = useRouteError();
  const [reference] = useState(() => crypto.randomUUID().slice(0, 8));
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation("system");

  useEffect(() => {
    console.error(`VERA crash ${reference}`, error);
  }, [error, reference]);

  return (
    <SystemPage
      title={t("crash.title")}
      text={t("crash.text")}
      actions={
        <>
          <Button onClick={() => window.location.reload()}>{t("crash.reload")}</Button>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(`${reference} ${error instanceof Error ? error.message : String(error)}`)
                .then(() => setCopied(true));
            }}
          >
            {copied ? t("crash.copied") : t("crash.copy")}
          </Button>
        </>
      }
    >
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {t("crash.reference", { id: reference })}
      </p>
    </SystemPage>
  );
}
