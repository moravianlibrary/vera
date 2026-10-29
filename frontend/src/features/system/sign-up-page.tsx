// System page: local account sign-up (ACCESS-sign-up).
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ApiError } from "@/api/http";
import { listMockSystemMail, sendVerificationAgain, signUp } from "@/api/sign-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/config/env";
import { safeReturnTo } from "@/lib/return-to";
import { SystemPage } from "./system-page";

function MockMail({ email }: { email: string }) {
  const { t } = useTranslation("system");
  const [mails, setMails] = useState<Awaited<ReturnType<typeof listMockSystemMail>>>([]);
  useState(() => {
    void listMockSystemMail().then(setMails);
  });
  if (env.VITE_API_MODE !== "mock") return null;
  return (
    <div className="mt-4 rounded-lg border p-3 text-left text-sm">
      <h2 className="font-medium">{t("checkEmail.mock")}</h2>
      {mails
        .filter((mail) => mail.to.toLowerCase() === email.toLowerCase())
        .map((mail) => (
          <p key={`${mail.sentAt}-${mail.subject}`} className="mt-2">
            {mail.subject}
            {mail.link && (
              <>
                {" "}
                ·{" "}
                <Link className="underline-offset-4 hover:underline" to={mail.link}>
                  {mail.link}
                </Link>
              </>
            )}
          </p>
        ))}
    </div>
  );
}
export function SignUpPage() {
  const { t } = useTranslation("system");
  const [params] = useSearchParams();
  const instance = params.get("instance") ?? "";
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [again, setAgain] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await signUp(instance, { name, email, username, password, website, returnTo });
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.problem?.code === "access.username_taken"
          ? t("signUp.usernameTaken")
          : e instanceof ApiError && e.problem?.code === "access.password_short"
            ? t("signUp.passwordShort", { count: 12 })
            : e instanceof ApiError && e.status === 429
              ? t("signUp.tooMany")
              : t("login.error.other"),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <SystemPage
      title={t(sent ? "checkEmail.title" : "signUp.title")}
      text={sent ? t("checkEmail.text", { email }) : undefined}
    >
      {sent ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t("checkEmail.text", { email })}</p>
          <Button
            className="mt-4"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await sendVerificationAgain(instance, email);
              setAgain(true);
              setPending(false);
            }}
          >
            {again ? t("checkEmail.sent") : t("checkEmail.again")}
          </Button>
          <MockMail email={email} />
        </>
      ) : (
        <form className="mt-6 grid gap-3 text-left" onSubmit={(event) => void submit(event)}>
          {(
            [
              ["name", name, setName],
              ["email", email, setEmail],
              ["username", username, setUsername],
              ["password", password, setPassword],
            ] as const
          ).map(([field, value, change]) => (
            <label key={field} className="grid gap-1 text-sm" htmlFor={`signup-${field}`}>
              {t(`signUp.${field}`)}
              <Input
                id={`signup-${field}`}
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                autoComplete={field === "password" ? "new-password" : field}
                value={value}
                onChange={(event) => change(event.target.value)}
              />
              {field === "password" && (
                <span className="text-muted-foreground">
                  {t("signUp.passwordHint", { count: 12 })}
                </span>
              )}
            </label>
          ))}
          {/* ACCESS-sign-up: a field people never see or fill; a script that fills it is ignored. */}
          <Input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="sr-only"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {t("signUp.submit")}
          </Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Link
            className="text-sm underline-offset-4 hover:underline"
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          >
            {t("signUp.haveAccount")}
          </Link>
        </form>
      )}
    </SystemPage>
  );
}
