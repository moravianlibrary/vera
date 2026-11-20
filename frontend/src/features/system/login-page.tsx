// Shape: System.
// The login system page: ordered Identity entries, return path and UI-language pick (ACCESS-login-page).

import { useQuery } from "@tanstack/react-query";
import { safeReturnTo } from "@vera/contract/return-to";
import { languages } from "@vera/contract/user-settings";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ApiError } from "@/api/http";
import { listLoginEntries, loginWithForm, startRedirectLogin } from "@/api/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { i18n } from "@/i18n";
import { languageNames, pickLoginLanguage } from "@/i18n/language";
import { SystemDivider, SystemPage } from "./system-page";

export function LoginPage() {
  const { t } = useTranslation("system");
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const errorCode = params.get("error");
  const entriesQuery = useQuery({ queryKey: ["login-entries"], queryFn: listLoginEntries });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [pendingInstance, setPendingInstance] = useState<string | null>(null);
  const { data: entries } = entriesQuery;
  const onlyRedirect =
    entries?.length === 1 && entries[0]?.entry === "redirect" && errorCode === null;

  useEffect(() => {
    if (onlyRedirect && entries?.[0] !== undefined) {
      void startRedirectLogin(entries[0].instanceId, returnTo);
    }
  }, [onlyRedirect, entries, returnTo]);

  const message =
    entriesQuery.isLoading || onlyRedirect
      ? t("login.loading")
      : entriesQuery.isError
        ? t("login.unavailable")
        : errorCode !== null
          ? errorCode === "access.suspended"
            ? t("login.error.access.suspended")
            : errorCode === "login.refused"
              ? t("login.error.login.refused")
              : t("login.error.other")
          : undefined;

  const submitForm = async (event: FormEvent<HTMLFormElement>, instanceId: string) => {
    event.preventDefault();
    setFormError("");
    setPendingInstance(instanceId);
    try {
      await loginWithForm(instanceId, { username, password });
      window.location.assign(returnTo);
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? t("login.wrongPassword")
          : t("login.error.other"),
      );
    } finally {
      setPendingInstance(null);
    }
  };

  const showsEntries = entries !== undefined && !onlyRedirect && !entriesQuery.isError;
  const providers = entries?.filter((entry) => entry.entry === "redirect") ?? [];
  const forms = entries?.filter((entry) => entry.entry === "form") ?? [];

  return (
    <SystemPage
      title={t("login.title")}
      text={message}
      actions={
        entriesQuery.isError ? (
          <Button onClick={() => void entriesQuery.refetch()}>{t("action.tryAgain")}</Button>
        ) : undefined
      }
      footer={
        <div className="flex items-center gap-1">
          <span>{t("login.language")}</span>
          {languages.map((language) => (
            <Button
              key={language}
              size="sm"
              variant="ghost"
              aria-pressed={i18n.resolvedLanguage === language}
              className="aria-pressed:text-foreground aria-pressed:font-medium"
              onClick={() => {
                pickLoginLanguage(language);
                void i18n.changeLanguage(language);
              }}
            >
              {languageNames[language]}
            </Button>
          ))}
        </div>
      }
    >
      {showsEntries && (
        <div className="mt-6">
          {providers.length > 0 && (
            <div className="grid gap-2">
              {providers.map((entry) => (
                <Button
                  key={entry.instanceId}
                  className="w-full"
                  variant="outline"
                  onClick={() => void startRedirectLogin(entry.instanceId, returnTo)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          )}
          {providers.length > 0 && forms.length > 0 && (
            <SystemDivider>{t("login.or")}</SystemDivider>
          )}
          {forms.map((entry) => (
            <form
              key={entry.instanceId}
              className="grid gap-3 rounded-lg border bg-muted/40 p-4"
              onSubmit={(event) => void submitForm(event, entry.instanceId)}
            >
              <h2 className="text-sm font-semibold">{entry.label}</h2>
              <div className="grid gap-1.5">
                <label className="text-sm" htmlFor={`${entry.instanceId}-username`}>
                  {t("login.username")}
                </label>
                <Input
                  id={`${entry.instanceId}-username`}
                  autoComplete="username"
                  className="bg-background"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="text-sm" htmlFor={`${entry.instanceId}-password`}>
                    {t("login.password")}
                  </label>
                  {entry.canResetPassword && (
                    <Link
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      to={`/forgot-password?instance=${encodeURIComponent(entry.instanceId)}`}
                    >
                      {t("forgot.link")}
                    </Link>
                  )}
                </div>
                <Input
                  id={`${entry.instanceId}-password`}
                  type="password"
                  autoComplete="current-password"
                  className="bg-background"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {formError !== "" && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <Button className="w-full" type="submit" disabled={pendingInstance !== null}>
                {t("login.submit")}
              </Button>
              {entry.canSignUp && (
                <p className="text-center text-sm text-muted-foreground">
                  {t("signUp.prompt")}{" "}
                  <Link
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    to={`/signup?instance=${encodeURIComponent(entry.instanceId)}&returnTo=${encodeURIComponent(returnTo)}`}
                  >
                    {t("signUp.link")}
                  </Link>
                </p>
              )}
            </form>
          ))}
        </div>
      )}
    </SystemPage>
  );
}
