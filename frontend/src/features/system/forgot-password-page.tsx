// System page: requesting a local account password reset (ACCESS-password-reset).
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { listMockSystemMail, requestPasswordReset } from "@/api/sign-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/config/env";
import { SystemPage } from "./system-page";
export function ForgotPasswordPage() {
  const { t } = useTranslation("system");
  const [params] = useSearchParams();
  const instance = params.get("instance") ?? "";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [mails, setMails] = useState<Awaited<ReturnType<typeof listMockSystemMail>>>([]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await requestPasswordReset(instance, email);
    if (env.VITE_API_MODE === "mock") setMails(await listMockSystemMail());
    setSent(true);
  };
  return (
    <SystemPage
      title={t(sent ? "forgot.sent" : "forgot.title")}
      text={sent ? undefined : t("forgot.text")}
    >
      {sent ? (
        <>
          <p className="mt-3 text-sm">{t("forgot.sent")}</p>
          {env.VITE_API_MODE === "mock" && (
            <div className="mt-4 rounded-lg border p-3 text-left text-sm">
              <h2>{t("checkEmail.mock")}</h2>
              {mails
                .filter((m) => m.to.toLowerCase() === email.toLowerCase())
                .map((m) => (
                  <p key={m.sentAt}>
                    {m.subject}
                    {m.link && (
                      <>
                        {" "}
                        ·{" "}
                        <a className="underline-offset-4 hover:underline" href={m.link}>
                          {m.link}
                        </a>
                      </>
                    )}
                  </p>
                ))}
            </div>
          )}
        </>
      ) : (
        <form className="mt-6 grid gap-3 text-left" onSubmit={(e) => void submit(e)}>
          <label htmlFor="forgot-email" className="grid gap-1 text-sm">
            {t("signUp.email")}
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Button type="submit">{t("forgot.submit")}</Button>
        </form>
      )}
    </SystemPage>
  );
}
