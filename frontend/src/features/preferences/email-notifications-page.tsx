import { useMutation, useQuery } from "@tanstack/react-query";
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

  if (isPending) return <div className="mx-auto max-w-xl p-8">Loading notification choices…</div>;
  if (isError || data === undefined)
    return (
      <div className="mx-auto max-w-xl p-8">
        <QueryError
          failure={
            failureOf(preferencesQuery, "This notification link is invalid or expired.") ?? {
              text: "This notification link is invalid or expired.",
              onRetry: () => void preferencesQuery.refetch(),
            }
          }
        />
      </div>
    );
  if (session?.user.id === data.userId) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-8">
        <h1 className="text-xl font-semibold">Email notifications</h1>
        <p>You are signed in as {data.email}. Manage these choices in your preferences.</p>
        <Button asChild>
          <Link to={`/preferences/notifications?hook=${encodeURIComponent(data.focusedHookId)}`}>
            Open preferences
          </Link>
        </Button>
      </div>
    );
  }
  if (session !== undefined) {
    return (
      <div className="mx-auto max-w-xl p-8">
        This link belongs to another account. Sign in as {data.email} to manage its notifications.
      </div>
    );
  }

  const choices = data.notifications;
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="text-xl font-semibold">Email notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choices for {data.email}. This link changes only automatic Hook emails.
        </p>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not save your choices.
        </p>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p className="font-medium">Do not send notifications</p>
          <p className="text-xs text-muted-foreground">
            Also suppresses enabled watchlist delivery. Individual choices stay saved.
          </p>
        </div>
        <Switch
          aria-label="Do not send notifications"
          checked={choices.doNotSend}
          disabled={save.isPending}
          onCheckedChange={(doNotSend) => save.mutate({ ...choices, doNotSend })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Hook emails</h2>
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
          Turn off all current Hook emails
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {data.hooks.map((hook) => (
          <div key={hook.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{hook.label}</p>
              <p className="text-xs text-muted-foreground">
                {hook.event} · {hook.defaultEnabled ? "On" : "Off"} by default
              </p>
            </div>
            <Switch
              aria-label={`${hook.label} email`}
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
