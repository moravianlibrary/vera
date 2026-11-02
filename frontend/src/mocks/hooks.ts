// The Hooks mock owns subscriptions, batching, retries and exhausted deliveries;
// each channel invocation is a single delivery attempt (STATUS "Hooks"; plugins.md §4.12).

import type {
  Hook,
  HookAttempt,
  HookChannel,
  HookDelivery,
  HookDraft,
  HookEvent,
  HookIndex,
  HookPreview,
  HookTestResult,
} from "@vera/contract/hooks";
import { hookEventSchema } from "@vera/contract/hooks";
import type { Session } from "@vera/domain/entities";
import { retryAtOf, sendAtOf } from "@vera/domain/hooks";
import { primaryLinkOf } from "@vera/domain/iterations";
import { hasPermission } from "@vera/domain/permissions";
import { database } from "@/mocks/database";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { issueNotificationToken } from "@/mocks/notification-tokens";
import { implementationOf, kindOf, liveInstances } from "@/mocks/plugin-instances";
import { mockNow } from "@/mocks/today";
import { userSettingsOf } from "@/mocks/user-settings";

const retentionDays = 30;
const forbidden: Refusal = { status: 403, message: "You may not configure hooks" };
const missing: Refusal = { status: 404, message: "No such hook or delivery" };

export function canReadHooks(session: Session): boolean {
  return hasPermission(session, "hook.read");
}

export function hookChannels(): HookChannel[] {
  return liveInstances().flatMap((instance): HookChannel[] => {
    if (kindOf(instance) !== "DeliveryChannel") {
      return [];
    }

    const version = implementationOf(instance)?.versions.find(
      (entry) => entry.version === instance.version,
    );
    const iface = version?.declares.channelInterface;
    if (iface === null || iface === undefined) {
      return [];
    }

    return [
      { id: instance.id, name: instance.name, interface: iface, isEnabled: instance.isEnabled },
    ];
  });
}

function channelRefusal(draft: HookDraft): Refusal | null {
  const channel = hookChannels().find((candidate) => candidate.id === draft.channelId);
  if (channel === undefined || !channel.isEnabled) {
    return {
      status: 422,
      code: "hook.channel_unavailable",
      message: "Choose an enabled delivery channel",
    };
  }

  if (channel.interface === "Webhook" && !/^https:\/\//.test(draft.recipient)) {
    return { status: 422, code: "hook.recipient", message: "A webhook needs an HTTPS URL" };
  }
  if (draft.recipientPreference != null && channel.interface !== "Email") {
    return {
      status: 422,
      code: "hook.recipient_preference",
      message: "User-controlled delivery needs an email channel",
    };
  }

  // TODO(rrandiak): define a typed condition builder for hook subscriptions.
  // The accepted demo supplies only these two phrases; an arbitrary phrase
  // cannot be executed safely or predictably by the mock server.
  if (draft.filter !== "" && draft.filter !== "category under Periodicals") {
    return {
      status: 422,
      code: "hook.filter_unsupported",
      message: "This event condition is not supported yet",
    };
  }

  return null;
}

function replaceDelivery(delivery: HookDelivery): HookDelivery {
  const index = database.hookDeliveries.findIndex((candidate) => candidate.id === delivery.id);
  database.hookDeliveries.splice(index, 1, delivery);
  return delivery;
}

// The mock invokes an enabled channel once. An unreachable demo endpoint fails
// predictably; a disabled channel cannot send. No network call leaves MSW.
function attemptDelivery(delivery: HookDelivery, now: Date): HookDelivery {
  const hook = database.hooks.find((candidate) => candidate.id === delivery.hookId);
  if (hook === undefined) {
    return delivery;
  }

  const channel = hookChannels().find((candidate) => candidate.id === hook.channelId);
  if (channel === undefined || !channel.isEnabled) {
    return delivery;
  }

  let recipientUserId: string | null = null;
  if (hook.recipientPreference != null) {
    const recipient = database.users.find(
      (user) => user.email?.toLowerCase() === delivery.recipient.toLowerCase(),
    );
    if (recipient === undefined) {
      return replaceDelivery({
        ...delivery,
        state: "gave_up",
        sendAt: null,
        lastError: "User-addressed Hook recipient is not a VERA user",
      });
    }
    recipientUserId = recipient.id;
    const settings = userSettingsOf(recipient.id).notifications;
    // WATCH-channel-off: *No hook email* stops every hook, those added later included.
    if (
      settings?.doNotSend ||
      settings?.noHookEmail === true ||
      settings?.hooks[hook.id] === false ||
      (settings?.hooks[hook.id] === undefined && !hook.recipientPreference.defaultEnabled)
    ) {
      return replaceDelivery({ ...delivery, state: "suppressed", sendAt: null, lastError: null });
    }
  }

  const failure = delivery.recipient.includes("ops.internal")
    ? "connect ETIMEDOUT ops.internal:443"
    : null;
  const attemptNumber = delivery.attempts + 1;
  const next = failure === null ? null : retryAtOf(now, attemptNumber, hook.retry);
  const updated: HookDelivery = {
    ...delivery,
    attempts: attemptNumber,
    state: failure === null ? "sent" : next === null ? "gave_up" : "waiting",
    sendAt: next?.toISOString() ?? null,
    lastError: failure,
    manageNotificationsUrl:
      failure === null && recipientUserId !== null
        ? `/email-notifications/${issueNotificationToken(recipientUserId, hook.id)}`
        : (delivery.manageNotificationsUrl ?? null),
  };
  const attempt: HookAttempt = {
    id: `HX-${crypto.randomUUID()}`,
    deliveryId: delivery.id,
    at: now.toISOString(),
    result: failure === null ? "sent" : "failed",
    detail: failure ?? "Delivered",
    durationMs: failure === null ? 160 : 0,
  };
  database.hookAttempts.push(attempt);
  return replaceDelivery(updated);
}

// Called when Hooks is read or acted on: due deliveries advance against mockNow.
export function settleDueDeliveries(now = mockNow()): void {
  for (const delivery of [...database.hookDeliveries]) {
    const hook = database.hooks.find((candidate) => candidate.id === delivery.hookId);
    if (
      hook?.state !== "active" ||
      !hookChannels().some((channel) => channel.id === hook.channelId && channel.isEnabled)
    ) {
      continue;
    }

    let current = delivery;
    while (
      current.state === "waiting" &&
      current.sendAt !== null &&
      Date.parse(current.sendAt) <= now.getTime()
    ) {
      current = attemptDelivery(current, new Date(current.sendAt));
    }
  }
}

export function hookIndex(): HookIndex {
  const now = mockNow();
  settleDueDeliveries(now);
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60_000;
  return {
    asOf: now.toISOString(),
    retentionDays,
    hooks: [...database.hooks],
    channels: hookChannels(),
    deliveries: database.hookDeliveries.filter(
      (delivery) =>
        delivery.state === "gave_up" ||
        delivery.state === "waiting" ||
        Date.parse(delivery.lastAt) >= cutoff,
    ),
    attempts: database.hookAttempts.filter((attempt) => Date.parse(attempt.at) >= cutoff),
  };
}

function checkWrite(session: Session): Refusal | null {
  return hasPermission(session, "hook.configure") ? null : forbidden;
}

export function createHook(session: Session, draft: HookDraft): Outcome<Hook> {
  const refusal = checkWrite(session) ?? channelRefusal(draft);
  if (refusal !== null) {
    return { refusal };
  }

  const hook: Hook = {
    ...draft,
    id: `H-${crypto.randomUUID()}`,
    state: "active",
    createdBy: session.user.id,
    createdAt: mockNow().toISOString(),
    pause: null,
  };
  database.hooks.push(hook);
  return { value: hook };
}

export function saveHook(session: Session, hookId: string, draft: HookDraft): Outcome<Hook> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const index = database.hooks.findIndex((hook) => hook.id === hookId);
  if (index < 0) {
    return { refusal: missing };
  }

  const channelProblem = channelRefusal(draft);
  if (channelProblem !== null) {
    return { refusal: channelProblem };
  }

  const original = database.hooks[index];
  const updated: Hook = { ...original, ...draft };
  database.hooks.splice(index, 1, updated);
  return { value: updated };
}

export function pauseHook(session: Session, hookId: string, reason: string): Outcome<Hook> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const hook = database.hooks.find((candidate) => candidate.id === hookId);
  if (hook === undefined) {
    return { refusal: missing };
  }

  if (hook.state === "paused") {
    return {
      refusal: { status: 409, code: "hook.already_paused", message: "It is already paused." },
    };
  }

  const updated: Hook = {
    ...hook,
    state: "paused",
    pause: { by: session.user.id, at: mockNow().toISOString(), reason },
  };
  database.hooks.splice(database.hooks.indexOf(hook), 1, updated);
  // Events collected before pause stay; events arriving during pause are ignored.
  return { value: updated };
}

export function resumeHook(session: Session, hookId: string): Outcome<Hook> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const hook = database.hooks.find((candidate) => candidate.id === hookId);
  if (hook === undefined) {
    return { refusal: missing };
  }

  if (hook.state === "active") {
    return { refusal: { status: 409, code: "hook.active", message: "Already active" } };
  }

  const updated: Hook = { ...hook, state: "active", pause: null };
  database.hooks.splice(database.hooks.indexOf(hook), 1, updated);
  return { value: updated };
}

export function deleteHook(session: Session, hookId: string): Outcome<null> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const index = database.hooks.findIndex((hook) => hook.id === hookId);
  if (index < 0) {
    return { refusal: missing };
  }

  database.hooks.splice(index, 1);
  database.hookDeliveries = database.hookDeliveries.filter(
    (delivery) => delivery.hookId !== hookId || delivery.state === "sent",
  );
  return { value: null };
}

export function retryDelivery(session: Session, deliveryId: string): Outcome<HookDelivery> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const delivery = database.hookDeliveries.find((candidate) => candidate.id === deliveryId);
  if (delivery === undefined) {
    return { refusal: missing };
  }

  if (delivery.state !== "gave_up") {
    return {
      refusal: {
        status: 409,
        code: "hook.not_exhausted",
        message: "This delivery has not given up",
      },
    };
  }

  const hook = database.hooks.find((candidate) => candidate.id === delivery.hookId);
  if (
    hook === undefined ||
    !hookChannels().some((channel) => channel.id === hook.channelId && channel.isEnabled)
  ) {
    return {
      refusal: {
        status: 409,
        code: "hook.channel_unavailable",
        message: "Enable this hook's delivery channel before retrying",
      },
    };
  }

  return { value: attemptDelivery({ ...delivery, attempts: 0 }, mockNow()) };
}

export function retryAllDeliveries(session: Session, hookId: string): Outcome<HookDelivery[]> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const hook = database.hooks.find((candidate) => candidate.id === hookId);
  if (hook === undefined) {
    return { refusal: missing };
  }

  if (!hookChannels().some((channel) => channel.id === hook.channelId && channel.isEnabled)) {
    return {
      refusal: {
        status: 409,
        code: "hook.channel_unavailable",
        message: "Enable this hook's delivery channel before retrying",
      },
    };
  }

  return {
    value: database.hookDeliveries
      .filter((delivery) => delivery.hookId === hookId && delivery.state === "gave_up")
      .map((delivery) => attemptDelivery({ ...delivery, attempts: 0 }, mockNow())),
  };
}

export function discardDelivery(session: Session, deliveryId: string): Outcome<HookDelivery> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const delivery = database.hookDeliveries.find((candidate) => candidate.id === deliveryId);
  if (delivery === undefined) {
    return { refusal: missing };
  }

  if (delivery.state !== "gave_up") {
    return {
      refusal: {
        status: 409,
        code: "hook.not_exhausted",
        message: "Only an exhausted delivery may be discarded",
      },
    };
  }

  return { value: replaceDelivery({ ...delivery, state: "discarded" }) };
}

export function sendNow(session: Session, hookId: string): Outcome<HookDelivery[]> {
  const refusal = checkWrite(session);
  if (refusal !== null) {
    return { refusal };
  }

  const hook = database.hooks.find((candidate) => candidate.id === hookId);
  if (hook === undefined) {
    return { refusal: missing };
  }

  if (hook.state !== "active") {
    return {
      refusal: {
        status: 409,
        code: "hook.already_paused",
        message: "It is already paused.",
      },
    };
  }

  if (!hookChannels().some((channel) => channel.id === hook.channelId && channel.isEnabled)) {
    return {
      refusal: {
        status: 409,
        code: "hook.channel_unavailable",
        message: "Enable this hook's delivery channel before sending",
      },
    };
  }

  return {
    value: database.hookDeliveries
      .filter(
        (delivery) =>
          delivery.hookId === hookId && delivery.state === "waiting" && delivery.attempts === 0,
      )
      .map((delivery) => attemptDelivery(delivery, mockNow())),
  };
}

export function previewHook(session: Session, draft: HookDraft): Outcome<HookPreview> {
  // A preview is public wording and does not mutate delivery state. Readers may inspect it;
  // the separate send-test endpoint still requires configuration permission.
  const refusal: Refusal | null = !canReadHooks(session)
    ? { status: 403, message: "You may not read hooks" }
    : channelRefusal(draft);
  if (refusal !== null) {
    return { refusal };
  }

  const channel = hookChannels().find((candidate) => candidate.id === draft.channelId);
  if (channel === undefined) {
    return { refusal: missing };
  }

  // A sample payload has public wording only. It never interpolates status-log
  // internal notes, plugin configuration or channel secrets.
  const event = draft.events[0];
  const sampleSubject = event.startsWith("run.")
    ? "T-9897"
    : event.startsWith("list.")
      ? "L-2026-015"
      : event.startsWith("request.")
        ? "R21"
        : "IT7";
  const sampleIteration = database.iterations.find((iteration) => iteration.id === "IT7");
  const sampleLink =
    sampleIteration === undefined ? null : (primaryLinkOf(sampleIteration)?.url ?? null);
  const publicText =
    draft.message === ""
      ? `${event}: ${sampleSubject}`
      : draft.message.replace(
          /\{(title|decision|public_text|link|task|error|list|pages|starts)\}/g,
          (_match, field: string) =>
            ({
              title: "Sample title",
              decision: "approved",
              public_text: "The request was approved",
              link: sampleLink ?? "https://vera.example/record",
              task: "Sample task",
              error: "A public error summary",
              list: "Sample list",
              pages: "18",
              starts: "1 July",
            })[field] ?? "",
        );
  return {
    value: { channel, recipient: draft.recipient, event, sampleSubject, publicText },
  };
}

export function sendTest(session: Session, draft: HookDraft): Outcome<HookTestResult> {
  const writeRefusal = checkWrite(session);
  if (writeRefusal !== null) {
    return { refusal: writeRefusal };
  }

  const preview = previewHook(session, draft);
  if ("refusal" in preview) {
    return preview;
  }

  const isUnreachable = draft.recipient.includes("ops.internal");
  return {
    value: {
      sent: !isUnreachable,
      detail: isUnreachable ? "connect ETIMEDOUT ops.internal:443" : "Test delivered",
      durationMs: isUnreachable ? 0 : 212,
    },
  };
}

// Other mock resources call this when they record a public event. A paused hook
// ignores it; batching merges only the same hook and (if configured) recipient.
export interface HookEventContext {
  readonly categoryPath?: readonly string[];
  readonly decision?: "Approved" | "Denied" | "Other";
}

function matchesFilter(hook: Hook, context: HookEventContext): boolean {
  if (hook.filter === "") {
    return true;
  }

  if (hook.filter === "category under Periodicals") {
    return context.categoryPath?.includes("Periodicals") ?? false;
  }

  return false;
}

export function recordHookEvent(
  event: HookEvent,
  subject: string,
  recipient: string,
  publicText: string,
  context: HookEventContext = {},
  at = mockNow(),
): void {
  if (!hookEventSchema.safeParse(event).success) {
    return;
  }

  for (const hook of database.hooks.filter(
    (candidate) =>
      candidate.events.includes(event) &&
      candidate.state === "active" &&
      matchesFilter(candidate, context),
  )) {
    const batch = hook.batch;
    const target = recipient || hook.recipient;
    const pending =
      batch === null
        ? undefined
        : database.hookDeliveries.find(
            (candidate) =>
              candidate.hookId === hook.id &&
              candidate.state === "waiting" &&
              candidate.attempts === 0 &&
              (batch.by === "all" || candidate.recipient === target),
          );
    if (pending !== undefined && batch !== null) {
      const updated: HookDelivery = {
        ...pending,
        subjects: [...pending.subjects, subject],
        events: [...pending.events, event],
        publicText: `${pending.publicText}\n${publicText}`,
        lastAt: at.toISOString(),
        sendAt: sendAtOf(new Date(pending.firstAt), at, batch).toISOString(),
      };
      replaceDelivery(updated);
      continue;
    }

    const delivery: HookDelivery = {
      id: `HD-${crypto.randomUUID()}`,
      hookId: hook.id,
      recipient: target,
      subjects: [subject],
      events: [event],
      publicText,
      state: "waiting",
      firstAt: at.toISOString(),
      lastAt: at.toISOString(),
      sendAt: batch === null ? at.toISOString() : sendAtOf(at, at, batch).toISOString(),
      attempts: 0,
      lastError: null,
    };
    database.hookDeliveries.push(delivery);
    if (batch === null) {
      attemptDelivery(delivery, at);
    }
  }
}

export function hooksUsingChannel(instanceId: string): Hook[] {
  return database.hooks.filter((hook) => hook.channelId === instanceId);
}
