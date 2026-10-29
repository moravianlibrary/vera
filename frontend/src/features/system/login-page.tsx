// The login system page: ordered Identity entries, return path and UI-language pick (ACCESS-login-page).

import { useQuery } from "@tanstack/react-query";
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
import { safeReturnTo } from "@/lib/return-to";
import { SystemPage } from "./system-page";

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

  return (
    <SystemPage
      title={t("login.title")}
      text={message}
      actions={
        entriesQuery.isError ? (
          <Button onClick={() => void entriesQuery.refetch()}>{t("action.tryAgain")}</Button>
        ) : undefined
      }
    >
      {entries !== undefined && !onlyRedirect && !entriesQuery.isError && (
        <div className="mt-6 grid gap-3 text-left">
          {entries.map((entry) =>
            entry.entry === "form" ? (
              <form
                key={entry.instanceId}
                className="grid gap-3"
                onSubmit={(event) => void submitForm(event, entry.instanceId)}
              >
                <label className="grid gap-1 text-sm" htmlFor={`${entry.instanceId}-username`}>
                  {t("login.username")}
                  <Input
                    id={`${entry.instanceId}-username`}
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm" htmlFor={`${entry.instanceId}-password`}>
                  {t("login.password")}
                  <Input
                    id={`${entry.instanceId}-password`}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <Button className="w-full" type="submit" disabled={pendingInstance !== null}>
                  {pendingInstance === entry.instanceId ? t("login.submit") : entry.label}
                </Button>
                {formError !== "" && (
                  <p className="text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                )}
                {entry.canSignUp && (
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    to={`/signup?instance=${encodeURIComponent(entry.instanceId)}&returnTo=${encodeURIComponent(returnTo)}`}
                  >
                    {t("signUp.link")}
                  </Link>
                )}
                {entry.canResetPassword && (
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    to={`/forgot-password?instance=${encodeURIComponent(entry.instanceId)}`}
                  >
                    {t("forgot.link")}
                  </Link>
                )}
              </form>
            ) : (
              <Button
                key={entry.instanceId}
                className="w-full"
                variant="outline"
                onClick={() => void startRedirectLogin(entry.instanceId, returnTo)}
              >
                {entry.label}
              </Button>
            ),
          )}
        </div>
      )}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm">
        <span>{t("login.language")}</span>
        {languages.map((language) => (
          <Button
            key={language}
            size="sm"
            variant="ghost"
            aria-pressed={i18n.resolvedLanguage === language}
            onClick={() => {
              pickLoginLanguage(language);
              void i18n.changeLanguage(language);
            }}
          >
            {languageNames[language]}
          </Button>
        ))}
      </div>
    </SystemPage>
  );
}
