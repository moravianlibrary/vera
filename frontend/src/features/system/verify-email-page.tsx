// System page: confirming a local account's email (ACCESS-verify-email).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/http";
import { confirmEmail } from "@/api/sign-up";
import { SystemPage } from "./system-page";
export function VerifyEmailPage() {
  const { t } = useTranslation("system");
  const { token = "" } = useParams();
  const once = useRef(false);
  const [state, setState] = useState<"working" | "done" | "expired">("working");
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void confirmEmail(token)
      .then(({ returnTo }) => {
        setState("done");
        window.setTimeout(() => window.location.assign(returnTo), 1200);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 410) setState("expired");
        else setState("expired");
      });
  }, [token]);
  return (
    <SystemPage
      title={t(
        state === "done" ? "verify.done" : state === "expired" ? "verify.expired" : "verify.title",
      )}
      actions={state === "expired" ? <Link to="/login">{t("action.login")}</Link> : undefined}
    />
  );
}
