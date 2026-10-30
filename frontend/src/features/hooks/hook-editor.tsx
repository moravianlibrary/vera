// A hook editor and explicit test flow over the shared dialog shell (STATUS "Hooks").
// The draft stays in the form while the preview and send-test steps are open.

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  Hook,
  HookChannel,
  HookDraft,
  HookPreview,
  HookTestResult,
} from "@vera/contract/hooks";
import {
  hookDraftSchema,
  hookEventSchema,
  hookGroupOfEvent,
  hookGroups,
} from "@vera/contract/hooks";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { previewHook, sendHookTest } from "@/api/hooks";
import { Field } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  events: ["iteration.published"],
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
  Email: "hooks:hookEditor.emailAddressOrRecipient",
  Chat: "hooks:hookEditor.channelOrPerson",
  Webhook: "hooks:hookEditor.httpsEndpoint",
  File: "hooks:hookEditor.destinationPath",
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
  const { t } = useTranslation("hooks");
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
            message: error instanceof Error ? error.message : t("hookEditor.previewFailure"),
          });
      });
    return () => {
      isCurrent = false;
    };
  }, [hook, startWithTest, t]);

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
        message: error instanceof Error ? error.message : t("hookEditor.previewFailure"),
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
          ? t("hookEditor.testTitle", { name: form.watch("name") || t("hookEditor.hook") })
          : hook === null
            ? t("hookEditor.newHook")
            : t("hookEditor.editHook", { name: hook.name })
      }
      description={t("hookEditor.description")}
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
        label:
          step === "test"
            ? t("hookEditor.sendTest")
            : hook === null
              ? t("hookEditor.createHook")
              : t("hookEditor.saveHook"),
        isDisabled: step === "test" && preview === null,
        isPending: form.formState.isSubmitting || test.isPending,
        onSelect: () => void (step === "test" ? send() : save()),
      }}
    >
      {step === "test" ? (
        <div className="grid gap-4">
          {preview === null ? (
            <p>{t("hookEditor.loadingPublicPreview")}</p>
          ) : (
            <p>
              {t("hookEditor.sampleThrough", {
                channel: preview.channel.name,
                recipient: preview.recipient,
              })}
            </p>
          )}
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("hookEditor.publicPreview")} · {preview?.sampleSubject}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">{preview?.publicText}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("hookEditor.testNotSaved")}</p>
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
          <Field id="hook-name" label={t("hookEditor.name")}>
            <Input
              id="hook-name"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
          </Field>
          <FieldError text={form.formState.errors.name?.message} />
          <Field id="hook-event" label={t("hookEditor.when")}>
            <Controller
              control={form.control}
              name="events"
              render={({ field }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    id="hook-event"
                    className="flex min-h-9 w-full items-center rounded-md border px-3 text-left text-xs focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {field.value.length <= 2
                      ? field.value.join(" · ")
                      : t("hookEditor.moreEvents", {
                          events: field.value.slice(0, 2).join(" · "),
                          count: field.value.length - 2,
                        })}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-80 w-80 overflow-y-auto">
                    {hookGroups.map((group, groupIndex) => (
                      <div key={group}>
                        {groupIndex > 0 && <DropdownMenuSeparator />}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {t(`hookEditor.group.${group}`)}
                        </div>
                        {hookEventSchema.options
                          .filter((event) => hookGroupOfEvent(event) === group)
                          .map((event) => (
                            <DropdownMenuCheckboxItem
                              key={event}
                              checked={field.value.includes(event)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked
                                    ? [...field.value, event]
                                    : field.value.filter((value) => value !== event),
                                )
                              }
                              onSelect={(e) => e.preventDefault()}
                              className="font-mono text-xs"
                            >
                              {event}
                            </DropdownMenuCheckboxItem>
                          ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            />
            <FieldError
              text={
                form.formState.errors.events?.message ??
                form.formState.errors.events?.root?.message ??
                (form.formState.errors.events ? t("hookEditor.pickEvent") : undefined)
              }
            />
          </Field>
          <Field id="hook-filter" label={t("hookEditor.onlyWhen")}>
            <Input
              id="hook-filter"
              {...form.register("filter")}
              aria-invalid={!!form.formState.errors.filter}
            />
          </Field>
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("hookEditor.filterHint")}
          </p>
          <FieldError text={form.formState.errors.filter?.message} />
          <Field id="hook-channel" label={t("hookEditor.sendThrough")}>
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
                    <SelectItem value={noChannel}>
                      {t("hookEditor.chooseDeliveryChannel")}
                    </SelectItem>
                    {channels.map((item) => (
                      <SelectItem key={item.id} value={item.id} disabled={!item.isEnabled}>
                        {item.name} · {t(`hooksView.${item.interface.toLowerCase()}`)}
                        {!item.isEnabled && ` (${t("hookEditor.disabled")})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <p className="-mt-2 text-xs text-muted-foreground">{t("hookEditor.channelsInPlugins")}</p>
          <FieldError text={form.formState.errors.channelId?.message} />
          <Field id="hook-recipient" label={t(destinationLabels[channel?.interface ?? "Email"])}>
            <Input
              id="hook-recipient"
              {...form.register("recipient")}
              aria-invalid={!!form.formState.errors.recipient}
            />
          </Field>
          <FieldError text={form.formState.errors.recipient?.message} />
          {channel?.interface === "Email" && (
            <fieldset className="grid gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">
                {t("hookEditor.recipientPreference")}
              </legend>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="hook-recipient-preference"
                  checked={recipientPreference != null}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      "recipientPreference",
                      checked === true
                        ? {
                            label: form.getValues("name") || t("hookEditor.hookEmail"),
                            defaultEnabled: false,
                          }
                        : null,
                      { shouldDirty: true },
                    )
                  }
                />
                <Label htmlFor="hook-recipient-preference">
                  {t("hookEditor.recipientCanTurnOff")}
                </Label>
              </div>
              {recipientPreference != null && (
                <>
                  <Field id="hook-preference-label" label={t("hookEditor.nameInPreferences")}>
                    <Input
                      id="hook-preference-label"
                      {...form.register("recipientPreference.label")}
                    />
                  </Field>
                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      aria-label={t("hookEditor.enabledByDefault")}
                      checked={recipientPreference.defaultEnabled}
                      onCheckedChange={(defaultEnabled) =>
                        form.setValue("recipientPreference.defaultEnabled", defaultEnabled, {
                          shouldDirty: true,
                        })
                      }
                    />
                    {t("hookEditor.enabledByDefault")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("hookEditor.preferenceDefaultDescription")}
                  </p>
                </>
              )}
            </fieldset>
          )}
          <Field id="hook-message" label={t("hookEditor.message")}>
            <Textarea id="hook-message" rows={3} {...form.register("message")} />
          </Field>
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("hookEditor.placeholders")}
          </p>
          <fieldset className="grid gap-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">{t("hookEditor.timing")}</legend>
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
                <Label htmlFor="hook-timing-once">{t("hookEditor.sendAtOnce")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="hook-timing-batch" value="batch" />
                <Label htmlFor="hook-timing-batch">{t("hookEditor.waitForMore")}</Label>
              </div>
            </RadioGroup>
            {batch !== null && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="hook-wait" label={t("hookEditor.quietWait")}>
                  <Input
                    id="hook-wait"
                    type="number"
                    min={1}
                    {...form.register("batch.waitMinutes", { valueAsNumber: true })}
                  />
                </Field>
                <Field id="hook-max" label={t("hookEditor.maximumWait")}>
                  <Input
                    id="hook-max"
                    type="number"
                    min={1}
                    {...form.register("batch.maxMinutes", { valueAsNumber: true })}
                  />
                </Field>
                <Field id="hook-by" label={t("hookEditor.combineBy")}>
                  <Controller
                    control={form.control}
                    name="batch.by"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="hook-by">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recipient">{t("hookEditor.recipient")}</SelectItem>
                          <SelectItem value="all">{t("hookEditor.allEvents")}</SelectItem>
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
            <legend className="px-1 text-sm font-medium">{t("hookEditor.ifDeliveryFails")}</legend>
            <Field id="hook-attempts" label={t("hookEditor.attempts")}>
              <Input
                id="hook-attempts"
                type="number"
                min={1}
                max={10}
                {...form.register("retry.attempts", { valueAsNumber: true })}
              />
            </Field>
            <Field id="hook-backoff" label={t("hookEditor.waitBetweenAttempts")}>
              <Controller
                control={form.control}
                name="retry.backoff"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="hook-backoff">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{t("hookEditor.fixedFiveMinutes")}</SelectItem>
                      <SelectItem value="exponential">{t("hookEditor.growingMinutes")}</SelectItem>
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
            {t("hookEditor.previewSendTest")}
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
