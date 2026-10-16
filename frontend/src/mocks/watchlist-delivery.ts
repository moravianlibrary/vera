// A deterministic mock outbox. The real service consumes entry events; MSW reconciles the
// current matching set when a watchlist is read and flushes due batches opportunistically.
import type { WatchlistView } from "@/domain/entities";
import type { PushNotice } from "@/domain/watchlist-push";
import { isPushDue, pushNoticeOf } from "@/domain/watchlist-push";
import { database } from "@/mocks/database";
import { pushAllowedSince } from "@/mocks/push";
import { sessionOf } from "@/mocks/session";
import { userSettingsOf } from "@/mocks/user-settings";
import { storeWatchlistEntries } from "@/mocks/watchlist-entries";
import { visibleWatchlists } from "@/mocks/watchlists";

export interface MockWatchlistMail {
  userId: string;
  sentAt: string;
  records: { view: string; recordId: string; watchlistIds: string[] }[];
  manageUrl: string;
}

export interface MockWatchlistNotice {
  userId: string;
  watchlistId: string;
  at: string;
  reason: "filter_changed" | "audience_removed" | "removed";
  channel: "email" | "chat";
}

export const watchlistMailOutbox: MockWatchlistMail[] = [];
export const watchlistNoticeOutbox: MockWatchlistNotice[] = [];
export const watchlistChatOutbox: {
  userId: string;
  watchlistId: string;
  view: string;
  recordId: string;
  sentAt: string;
  manageUrl: string;
}[] = [];
const batchMilliseconds = 15 * 60_000;

export function flushWatchlistMail(now = new Date()): MockWatchlistMail[] {
  const sent: MockWatchlistMail[] = [];
  for (const user of database.users) {
    const session = sessionOf(user.id);
    if (session === null || userSettingsOf(user.id).notifications?.doNotSend) continue;
    // Reconcile current membership and access at send time, including a changed audience.
    const visible = visibleWatchlists(session, null);
    const eligible = new Map(visible.map((summary) => [summary.id, summary]));
    const pending = database.watchlistEntries.filter((entry) => {
      if (entry.userId !== user.id || entry.baseline || entry.emailDeliveredAt !== null)
        return false;
      const summary = eligible.get(entry.watchlistId);
      if (
        summary === undefined ||
        !summary.viewer.email ||
        (summary.filterVersion > 1 &&
          summary.viewer.confirmedFilter !== String(summary.filterVersion)) ||
        (summary.viewer.emailSince !== null && entry.enteredAt <= summary.viewer.emailSince) ||
        (summary.viewer.seenAt !== null && entry.enteredAt <= summary.viewer.seenAt)
      )
        return false;
      return true;
    });
    if (pending.length === 0) continue;
    const oldest = Math.min(...pending.map((entry) => Date.parse(entry.enteredAt)));
    if (now.getTime() - oldest < batchMilliseconds) continue;
    const records = new Map<string, MockWatchlistMail["records"][number]>();
    for (const entry of pending) {
      const summary = eligible.get(entry.watchlistId);
      if (summary === undefined) continue;
      const key = `${summary.view}:${entry.recordId}`;
      const record = records.get(key) ?? {
        view: summary.view,
        recordId: entry.recordId,
        watchlistIds: [],
      };
      record.watchlistIds.push(entry.watchlistId);
      records.set(key, record);
      entry.emailDeliveredAt = now.toISOString();
    }
    if (records.size === 0) continue;
    const mail = {
      userId: user.id,
      sentAt: now.toISOString(),
      records: [...records.values()],
      manageUrl: "/watchlists",
    };
    watchlistMailOutbox.push(mail);
    sent.push(mail);
  }
  if (sent.length > 0) storeWatchlistEntries(database.watchlistEntries);
  return sent;
}

export function flushWatchlistChat(now = new Date()): void {
  let changed = false;
  for (const user of database.users) {
    const session = sessionOf(user.id);
    if (session === null || userSettingsOf(user.id).notifications?.doNotSend) continue;
    const visible = new Map(
      visibleWatchlists(session, null).map((summary) => [summary.id, summary]),
    );
    for (const entry of database.watchlistEntries) {
      if (entry.userId !== user.id || entry.baseline || entry.chatDeliveredAt !== null) continue;
      const summary = visible.get(entry.watchlistId);
      if (
        summary === undefined ||
        !summary.viewer.chat ||
        (summary.filterVersion > 1 &&
          summary.viewer.confirmedFilter !== String(summary.filterVersion)) ||
        (summary.viewer.chatSince !== null && entry.enteredAt <= summary.viewer.chatSince) ||
        (summary.viewer.seenAt !== null && entry.enteredAt <= summary.viewer.seenAt)
      )
        continue;
      watchlistChatOutbox.push({
        userId: user.id,
        watchlistId: entry.watchlistId,
        view: summary.view,
        recordId: entry.recordId,
        sentAt: now.toISOString(),
        manageUrl: `/watchlists?watchlist=${encodeURIComponent(entry.watchlistId)}`,
      });
      entry.chatDeliveredAt = now.toISOString();
      changed = true;
    }
  }
  if (changed) storeWatchlistEntries(database.watchlistEntries);
}

export interface MockWatchlistPush extends PushNotice {
  userId: string;
  watchlistId: string;
  sentAt: string;
  url: string;
}

export const watchlistPushOutbox: MockWatchlistPush[] = [];

// What a push names a record by: its title, name or what ran; its id when nothing names it.
function recordNameOf(view: WatchlistView, recordId: string): string {
  const titleOf = (documentId: string | undefined) =>
    database.documents.find((document) => document.id === documentId)?.title;
  switch (view) {
    case "documents":
    case "my-documents":
    case "requests":
      return titleOf(recordId) ?? recordId;
    case "validations":
      return (
        titleOf(database.iterations.find((iteration) => iteration.id === recordId)?.documentId) ??
        recordId
      );
    case "lists":
      return database.lists.find((list) => list.id === recordId)?.name ?? recordId;
    case "projects":
      return database.projects.find((project) => project.id === recordId)?.name ?? recordId;
    case "categories":
      return database.categories.find((category) => category.id === recordId)?.name ?? recordId;
    case "tasks":
      return database.runs.find((run) => run.id === recordId)?.what ?? recordId;
    default:
      return recordId;
  }
}

// WATCH-push: per person and watchlist, once the batch is due; only for a person with a browser
// allowed, and only what entered since then or since they switched push on, and not yet opened.
// Only for the people named, when some are: reconciling everyone's watchlists every few seconds
// is more than a tab should do.
export function flushWatchlistPush(
  now = new Date(),
  userIds: readonly string[] | null = null,
): MockWatchlistPush[] {
  const sent: MockWatchlistPush[] = [];
  for (const user of database.users) {
    if (userIds !== null && !userIds.includes(user.id)) continue;
    const allowedSince = pushAllowedSince(user.id);
    const session = sessionOf(user.id);
    if (
      allowedSince === null ||
      session === null ||
      userSettingsOf(user.id).notifications?.doNotSend
    )
      continue;
    for (const summary of visibleWatchlists(session, null)) {
      const { viewer } = summary;
      if (
        !viewer.push ||
        (summary.filterVersion > 1 && viewer.confirmedFilter !== String(summary.filterVersion))
      )
        continue;
      const pending = database.watchlistEntries.filter(
        (entry) =>
          entry.userId === user.id &&
          entry.watchlistId === summary.id &&
          !entry.baseline &&
          entry.pushDeliveredAt === null &&
          entry.enteredAt > allowedSince &&
          (viewer.pushSince === null || entry.enteredAt > viewer.pushSince) &&
          (viewer.seenAt === null || entry.enteredAt > viewer.seenAt),
      );
      if (
        !isPushDue(
          pending.map((entry) => new Date(entry.enteredAt)),
          now,
        )
      )
        continue;
      for (const entry of pending) entry.pushDeliveredAt = now.toISOString();
      const push = {
        userId: user.id,
        watchlistId: summary.id,
        sentAt: now.toISOString(),
        url: `/watchlists?watchlist=${encodeURIComponent(summary.id)}`,
        ...pushNoticeOf(
          summary.name,
          pending.map((entry) => recordNameOf(summary.view, entry.recordId)),
        ),
      };
      watchlistPushOutbox.push(push);
      sent.push(push);
    }
  }
  if (sent.length > 0) storeWatchlistEntries(database.watchlistEntries);
  return sent;
}

export function noteSystemWatchlistChange(
  watchlistId: string,
  reason: MockWatchlistNotice["reason"],
  userIds: string[],
): void {
  const at = new Date().toISOString();
  for (const userId of userIds) {
    if (userSettingsOf(userId).notifications?.doNotSend) continue;
    const viewer = database.watchlistViewers.find(
      (row) => row.watchlistId === watchlistId && row.userId === userId,
    );
    if (viewer?.email)
      watchlistNoticeOutbox.push({ userId, watchlistId, at, reason, channel: "email" });
    if (viewer?.chat)
      watchlistNoticeOutbox.push({ userId, watchlistId, at, reason, channel: "chat" });
  }
}
