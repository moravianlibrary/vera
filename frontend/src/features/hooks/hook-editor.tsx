// A hook editor and explicit test flow over the shared dialog shell (STATUS "Hooks").
// The draft stays in the form while the preview and send-test steps are open.
// TODO(rrandiak): labels move to i18n.

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  Hook,
  HookChannel,
  HookDraft,
  HookPreview,
  HookTestResult,
} from "@vera/contract/hooks";
import { hookDraftSchema, hookEventSchema } from "@vera/contract/hooks";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { previewHook, sendHookTest } from "@/api/hooks";
import { Field } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";

const emptyHookDraft: HookDraft = {
  name: "",
  event: "iteration.published",
  filter: "",
  channelId: "",
  recipient: "",
  message: "",
  batch: null,
  retry: { attempts: 3, backoff: "exponential" },
  recipientPreference: null,
};

interface HookEditorProps {
  hook: Hook | null;
  channels: readonly HookChannel[];
  onClose: () => void;
  onSave: (draft: HookDraft) => Promise<ActionResult<Hook>>;
  onSaved: (hook: Hook) => void;
  startWithTest?: boolean;
}

const destinationLabels = {
  Email: "Email address or recipient",
  Chat: "Channel or person",
  Webhook: "HTTPS endpoint",
  File: "Destination path",
} as const;
const noChannel = "__none__";

export function HookEditor({
  hook,
  channels,
  onClose,
  onSave,
  onSaved,
  startWithTest = false,
}: HookEditorProps) {
  const [step, setStep] = useState<"edit" | "test">(startWithTest ? "test" : "edit");
  const [preview, setPreview] = useState<HookPreview | null>(null);
  const [testResult, setTestResult] = useState<HookTestResult | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const form = useForm<HookDraft>({
    resolver: zodResolver(hookDraftSchema),
    defaultValues: hook ?? {
      ...emptyHookDraft,
      channelId: channels.find((channel) => channel.isEnabled)?.id ?? "",
    },
  });
  const test = useActionMutation({ call: sendHookTest, invalidates: [] });
  const channelId = form.watch("channelId");
  const channel = channels.find((item) => item.id === channelId);
  const batch = form.watch("batch");
  const recipientPreference = form.watch("recipientPreference");

  useEffect(() => {
    if (!startWithTest || hook === null) return;
    let isCurrent = true;
    previewHook(hook)
      .then((result) => {
        if (isCurrent) setPreview(result);
      })
      .catch((error) => {
        if (isCurrent)
          setRefusal({
            status: null,
            code: null,
            message: error instanceof Error ? error.message : "The preview could not be loaded.",
          });
      });
    return () => {
      isCurrent = false;
    };
  }, [hook, startWithTest]);

  const beginTest = form.handleSubmit(async (draft) => {
    setRefusal(null);
    try {
      setPreview(await previewHook(draft));
      setTestResult(null);
      setStep("test");
    } catch (error) {
      setRefusal({
        status: null,
        code: null,
        message: error instanceof Error ? error.message : "The preview could not be loaded.",
      });
    }
  });

  const send = form.handleSubmit(async (draft) => {
    const result = await test.run(draft);
    if (result.isDone) {
      setTestResult(result.value);
      return;
    }
    setRefusal(result.refusal);
  });

  const save = form.handleSubmit(async (draft) => {
    const result = await onSave(draft);
    if (result.isDone) {
      onSaved(result.value);
      return;
    }
    setRefusal(result.refusal);
    if (result.refusal.code === "hook.recipient")
      form.setError("recipient", { message: result.refusal.message });
    if (result.refusal.code === "hook.filter_unsupported")
      form.setError("filter", { message: result.refusal.message });
    if (result.refusal.code === "hook.channel_unavailable")
      form.setError("channelId", { message: result.refusal.message });
  });

  const close = () => {
    form.reset();
    setRefusal(null);
    onClose();
  };

  return (
    <DialogShell
      isOpen
      onClose={close}
      title={
        step === "test"
          ? `Test ${form.watch("name") || "hook"}`
          : hook === null
            ? "New hook"
            : `Edit ${hook.name}`
      }
      description="Configure an outbound subscription and test its public message."
      width="wide"
      isDirty={form.formState.isDirty}
      onBack={
        step === "test"
          ? () => {
              setStep("edit");
              setRefusal(null);
            }
          : undefined
      }
      refusal={refusal}
      primary={{
        label: step === "test" ? "Send test" : hook === null ? "Create hook" : "Save hook",
        isDisabled: step === "test" && preview === null,
        isPending: form.formState.isSubmitting || test.isPending,
        onSelect: () => void (step === "test" ? send() : save()),
      }}
    >
      {step === "test" ? (
        <div className="grid gap-4">
          {preview === null ? (
            <p>Loading public preview…</p>
          ) : (
            <p>
              Send a sample through {preview.channel.name} to <strong>{preview.recipient}</strong>.
            </p>
          )}
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Public preview · {preview?.sampleSubject}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">{preview?.publicText}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sending a test does not save this hook or add delivery history.
          </p>
          {testResult !== null && (
            <p
              role="status"
              className={testResult.sent ? "text-tone-green-foreground" : "text-destructive"}
            >
              {testResult.detail}
              {testResult.sent && ` · ${testResult.durationMs} ms`}
            </p>
          )}
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field id="hook-name" label="Name">
            <Input
              id="hook-name"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
          </Field>
          <FieldError text={form.formState.errors.name?.message} />
          <Field id="hook-event" label="When">
            <Controller
              control={form.control}
              name="event"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="hook-event">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hookEventSchema.options.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="hook-filter" label="Only when">
            <Input
              id="hook-filter"
              {...form.register("filter")}
              aria-invalid={!!form.formState.errors.filter}
            />
          </Field>
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            Leave empty for every event. Supported: category under Periodicals; decision is Approved
            or Denied.
          </p>
          <FieldError text={form.formState.errors.filter?.message} />
          <Field id="hook-channel" label="Send through">
            <Controller
              control={form.control}
              name="channelId"
              render={({ field }) => (
                <Select
                  value={field.value || noChannel}
                  onValueChange={(value) => field.onChange(value === noChannel ? "" : value)}
                >
                  <SelectTrigger id="hook-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noChannel}>Choose a delivery channel</SelectItem>
                    {channels.map((item) => (
                      <SelectItem key={item.id} value={item.id} disabled={!item.isEnabled}>
                        {item.name} · {item.interface}
                        {!item.isEnabled && " (disabled)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <p className="-mt-2 text-xs text-muted-foreground">
            Delivery channels are configured in Plugins.
          </p>
          <FieldError text={form.formState.errors.channelId?.message} />
          <Field id="hook-recipient" label={destinationLabels[channel?.interface ?? "Email"]}>
            <Input
              id="hook-recipient"
              {...form.register("recipient")}
              aria-invalid={!!form.formState.errors.recipient}
            />
          </Field>
          <FieldError text={form.formState.errors.recipient?.message} />
          {channel?.interface === "Email" && (
            <fieldset className="grid gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Recipient preference</legend>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="hook-recipient-preference"
                  checked={recipientPreference != null}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      "recipientPreference",
                      checked === true
                        ? { label: form.getValues("name") || "Hook email", defaultEnabled: false }
                        : null,
                      { shouldDirty: true },
                    )
                  }
                />
                <Label htmlFor="hook-recipient-preference">
                  Recipient is a VERA user who can turn this email off
                </Label>
              </div>
              {recipientPreference != null && (
                <>
                  <Field id="hook-preference-label" label="Name in user preferences">
                    <Input
                      id="hook-preference-label"
                      {...form.register("recipientPreference.label")}
                    />
                  </Field>
                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      aria-label="Enabled by default for recipients"
                      checked={recipientPreference.defaultEnabled}
                      onCheckedChange={(defaultEnabled) =>
                        form.setValue("recipientPreference.defaultEnabled", defaultEnabled, {
                          shouldDirty: true,
                        })
                      }
                    />
                    Enabled by default for recipients
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Existing choices follow this Hook when it is edited. New recipients use this
                    explicit default.
                  </p>
                </>
              )}
            </fieldset>
          )}
          <Field id="hook-message" label="Message">
            <Textarea id="hook-message" rows={3} {...form.register("message")} />
          </Field>
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            Use public placeholders such as {"{title}"}, {"{decision}"}, {"{public_text}"}, and{" "}
            {"{link}"}.
          </p>
          <fieldset className="grid gap-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Timing</legend>
            <RadioGroup
              value={batch === null ? "once" : "batch"}
              onValueChange={(value) =>
                form.setValue(
                  "batch",
                  value === "once" ? null : { waitMinutes: 15, maxMinutes: 60, by: "recipient" },
                  { shouldDirty: true },
                )
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="hook-timing-once" value="once" />
                <Label htmlFor="hook-timing-once">Send each event at once</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="hook-timing-batch" value="batch" />
                <Label htmlFor="hook-timing-batch">Wait for more</Label>
              </div>
            </RadioGroup>
            {batch !== null && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="hook-wait" label="Quiet wait · min">
                  <Input
                    id="hook-wait"
                    type="number"
                    min={1}
                    {...form.register("batch.waitMinutes", { valueAsNumber: true })}
                  />
                </Field>
                <Field id="hook-max" label="Maximum wait · min">
                  <Input
                    id="hook-max"
                    type="number"
                    min={1}
                    {...form.register("batch.maxMinutes", { valueAsNumber: true })}
                  />
                </Field>
                <Field id="hook-by" label="Combine by">
                  <Controller
                    control={form.control}
                    name="batch.by"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="hook-by">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recipient">Recipient</SelectItem>
                          <SelectItem value="all">All events</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
            )}
            <FieldError
              text={
                form.formState.errors.batch?.message ??
                form.formState.errors.batch?.maxMinutes?.message
              }
            />
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">If delivery fails</legend>
            <Field id="hook-attempts" label="Attempts">
              <Input
                id="hook-attempts"
                type="number"
                min={1}
                max={10}
                {...form.register("retry.attempts", { valueAsNumber: true })}
              />
            </Field>
            <Field id="hook-backoff" label="Wait between attempts">
              <Controller
                control={form.control}
                name="retry.backoff"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="hook-backoff">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed · 5 min</SelectItem>
                      <SelectItem value="exponential">Growing · 1, 2, 4… min</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </fieldset>
          <FieldError text={form.formState.errors.retry?.attempts?.message} />
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => void beginTest()}
          >
            Preview and send a test…
          </Button>
        </form>
      )}
    </DialogShell>
  );
}

function FieldError({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="text-xs text-destructive">
      {text}
    </p>
  ) : null;
}
