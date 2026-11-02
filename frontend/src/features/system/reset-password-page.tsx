// Shape: System.
// System page: setting a local account password (ACCESS-password-reset).
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/http";
import { resetPassword } from "@/api/sign-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemPage } from "./system-page";
export function ResetPasswordPage() {
  const { t } = useTranslation("system");
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await resetPassword({ token, password });
      setState("done");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 410
          ? t("reset.expired")
          : err instanceof ApiError && err.problem?.code === "access.password_short"
            ? t("signUp.passwordShort", { count: 12 })
            : t("login.error.other"),
      );
    }
  };
  return (
    <SystemPage
      title={t(state ? "reset.done" : "reset.title")}
      actions={state ? <Link to="/login">{t("action.login")}</Link> : undefined}
    >
      {!state && (
        <form className="mt-6 grid gap-3 text-left" onSubmit={(e) => void submit(e)}>
          <label htmlFor="reset-password" className="grid gap-1 text-sm">
            {t("signUp.password")}
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit">{t("reset.submit")}</Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </SystemPage>
  );
}
