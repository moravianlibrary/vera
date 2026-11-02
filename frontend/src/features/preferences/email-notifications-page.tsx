// Shape: System.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import {
  getPublicNotificationPreferences,
  updatePublicNotificationPreferences,
} from "@/api/notification-preferences";
import { failureOf, QueryError } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSessionQuery } from "@/hooks/use-session-query";

// A limited email link: it can change only notification choices for its recipient.
export function EmailNotificationsPage() {
  const { t } = useTranslation("preferences");
  const { token = "" } = useParams();
  const { data: session } = useSessionQuery();
  const preferencesQuery = useQuery({
    queryKey: ["email-notification-choices", token],
    queryFn: () => getPublicNotificationPreferences(token),
    retry: false,
  });
  const { data, isPending, isError, refetch } = preferencesQuery;
  const save = useMutation({
    mutationFn: (notifications: NonNullable<typeof data>["notifications"]) =>
      updatePublicNotificationPreferences(token, notifications),
    onSuccess: () => void refetch(),
  });

  if (isPending) return <div className="mx-auto max-w-xl p-8">{t("emailLink.loading")}</div>;
  if (isError || data === undefined)
    return (
      <div className="mx-auto max-w-xl p-8">
        <QueryError
          failure={
            failureOf(preferencesQuery, t("emailLink.invalid")) ?? {
              text: t("emailLink.invalid"),
              onRetry: () => void preferencesQuery.refetch(),
            }
          }
        />
      </div>
    );
  if (session?.user.id === data.userId) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-8">
        <h1 className="text-xl font-semibold">{t("emailLink.title")}</h1>
        <p>{t("emailLink.signedIn", { email: data.email })}</p>
        <Button asChild>
          <Link to={`/preferences/notifications?hook=${encodeURIComponent(data.focusedHookId)}`}>
            {t("emailLink.openPreferences")}
          </Link>
        </Button>
      </div>
    );
  }
  if (session !== undefined) {
    return (
      <div className="mx-auto max-w-xl p-8">
        {t("emailLink.wrongAccount", { email: data.email })}
      </div>
    );
  }

  const choices = data.notifications;
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="text-xl font-semibold">{t("emailLink.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("emailLink.choicesFor", { email: data.email })}
        </p>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("emailLink.saveError")}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p className="font-medium">{t("notifications.doNotSend")}</p>
          <p className="text-xs text-muted-foreground">{t("emailLink.doNotSendDescription")}</p>
        </div>
        <Switch
          aria-label={t("notifications.doNotSend")}
          checked={choices.doNotSend}
          disabled={save.isPending}
          onCheckedChange={(doNotSend) => save.mutate({ ...choices, doNotSend })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("notifications.hookEmails")}</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              ...choices,
              hooks: {
                ...choices.hooks,
                ...Object.fromEntries(data.hooks.map((hook) => [hook.id, false])),
              },
            })
          }
        >
          {t("emailLink.turnOffAll")}
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {data.hooks.map((hook) => (
          <div key={hook.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{hook.label}</p>
              <p className="text-xs text-muted-foreground">
                {hook.events.join(" · ")} ·{" "}
                {t(hook.defaultEnabled ? "emailLink.on" : "emailLink.off")}{" "}
                {t("emailLink.byDefault")}
              </p>
            </div>
            <Switch
              aria-label={t("emailLink.hookEmail", { name: hook.label })}
              checked={choices.hooks[hook.id] ?? hook.defaultEnabled}
              disabled={save.isPending}
              onCheckedChange={(enabled) =>
                save.mutate({ ...choices, hooks: { ...choices.hooks, [hook.id]: enabled } })
              }
            />
          </div>
        ))}
      </div>
    </main>
  );
}
