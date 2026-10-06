// What the server does for *Message…* (messaging.md): offers the enabled Message instances in
// their order, resolves who a message about a record goes to (§3) and lets each instance say
// whom it can reach and where it hands off to (§2). It keeps nothing: a redirect is not logged,
// since VERA cannot know it was sent (§4). A record the caller cannot see is not found.

import type { MessageChannel, MessageHandOff, MessageSubject } from "@/api/messages";
import { navigationEntries } from "@/components/layout/navigation";
import { documentIdentifierOf } from "@/domain/documents";
import type { Session, User } from "@/domain/entities";
import { askerIdsOf, asksOf, projectIdsOf } from "@/domain/proposal-review";
import { plural } from "@/lib/plural";
import { database } from "@/mocks/database";
import type { MessageInstance } from "@/mocks/fixtures/message-channels";
import { messageInstances, slackHandles, slackWorkspace } from "@/mocks/fixtures/message-channels";
import type { Outcome } from "@/mocks/mutations";
import { findReachableRow } from "@/mocks/proposal-review";

const channelDescriptions = {
  mailto: "opens your mail, pre-filled",
  slack: "opens a Slack message",
} as const satisfies Record<MessageInstance["implementation"], string>;

function enabledInstances(): MessageInstance[] {
  return messageInstances
    .filter((instance) => instance.isEnabled)
    .toSorted((first, second) => first.order - second.order);
}

export function messageChannels(): MessageChannel[] {
  return enabledInstances().map(({ id, name, implementation }) => ({
    id,
    name,
    description: channelDescriptions[implementation],
  }));
}

// The record a message is about, and the people it goes to; null when the caller cannot see it.
interface ResolvedSubject {
  label: string;
  path: string;
  context: string;
  recipientIds: readonly string[];
}

function resolveSubject(session: Session, subject: MessageSubject): ResolvedSubject | null {
  const row = findReachableRow(session, subject.id);
  if (row === null) {
    return null;
  }

  const { document } = row.record;
  const projectNames = projectIdsOf(row).flatMap(
    (projectId) => database.projects.find((project) => project.id === projectId)?.name ?? [],
  );
  return {
    label: `${document.title} · ${documentIdentifierOf(document)}`,
    path: `${pathOf("proposals")}?id=${encodeURIComponent(document.id)}`,
    context: ["Proposed for digitization", plural(asksOf(row).length, "ask"), ...projectNames].join(
      " · ",
    ),
    // A proposal's message goes to its requesters (§3).
    recipientIds: askerIdsOf(row),
  };
}

function pathOf(entryId: string): string {
  return navigationEntries.find((entry) => entry.id === entryId)?.path ?? "/";
}

export function prepareMessage(session: Session, subject: MessageSubject): Outcome<MessageHandOff> {
  const resolved = resolveSubject(session, subject);
  if (resolved === null) {
    return { refusal: { status: 404, message: "Nothing to message about here" } };
  }

  // People only: an agent is a plugin, and nobody writes to themselves.
  const recipients = resolved.recipientIds
    .filter((userId) => userId !== session.user.id)
    .flatMap((userId) => database.users.find((user) => user.id === userId) ?? [])
    .filter((user) => user.kind === "person");
  const link = `${originOf()}${resolved.path}`;

  return {
    value: {
      about: { label: resolved.label, path: resolved.path },
      context: resolved.context,
      recipients: recipients.map((user) => ({ userId: user.id, name: user.name })),
      handOffs: enabledInstances().map((instance) => {
        const reachable = recipients.filter((user) => canReach(instance, user));
        return {
          channelId: instance.id,
          reachableIds: reachable.map(({ id }) => id),
          href:
            reachable.length === 0
              ? null
              : hrefOf(instance, reachable, {
                  subject: `[VERA] ${resolved.label}`,
                  context: resolved.context,
                  link,
                }),
        };
      }),
    },
  };
}

// The server would know its own public address; the mock serves the page it runs in.
function originOf(): string {
  return globalThis.location?.origin ?? "http://localhost";
}

function canReach(instance: MessageInstance, user: User): boolean {
  return instance.implementation === "slack" ? user.id in slackHandles : user.email !== null;
}

interface Prefill {
  subject: string;
  context: string;
  link: string;
}

function hrefOf(instance: MessageInstance, reachable: readonly User[], prefill: Prefill): string {
  const body = `${prefill.context}\n\n${prefill.link}`;
  if (instance.implementation === "slack") {
    const handles = reachable.map((user) => slackHandles[user.id]).join(",");
    const params = new URLSearchParams({ team: slackWorkspace, users: handles, text: body });
    return `https://slack.com/app_redirect?${params.toString()}`;
  }

  const addresses = reachable.map((user) => user.email).join(",");
  return `mailto:${addresses}?subject=${encodeURIComponent(prefill.subject)}&body=${encodeURIComponent(body)}`;
}
