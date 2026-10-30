// What the server does for *Message…* (messaging.md): offers the enabled Message instances in
// their order, resolves who a message about a record goes to (MSG-recipients) and lets each
// instance say whom it can reach and where it hands off to (§2). It keeps nothing: a redirect
// is not logged, since VERA cannot know it was sent (§4). A record the caller cannot see is not
// found.

import type { MessageChannel, MessageHandOff, MessageSubject } from "@vera/contract/messages";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Session, User } from "@vera/domain/entities";
import { askerIdsOf, asksOf, projectIdsOf } from "@vera/domain/requests";
import { navigationEntries } from "@/components/layout/navigation";
import { i18n } from "@/i18n";
import { database } from "@/mocks/database";
import { findDocumentDetail } from "@/mocks/documents";
import type { MessageImplementation } from "@/mocks/fixtures/message-channels";
import { slackHandles, slackWorkspace } from "@/mocks/fixtures/message-channels";
import type { Outcome } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";
import { findProjectDetail } from "@/mocks/projects";
import { findReachableRow } from "@/mocks/requests";
import { holdersOfPermission } from "@/mocks/session";
import { findReachableValidation } from "@/mocks/validations";

const channelDescriptions = {
  mailto: "opens your mail, pre-filled",
  slack: "opens a Slack message",
  slackBot: "sends a Slack direct message",
} as const satisfies Record<MessageImplementation, string>;

interface MessageInstance {
  readonly id: string;
  readonly name: string;
  readonly implementation: MessageImplementation;
}

// The implementations the mock plays, by name.
const implementationsByName: Readonly<Record<string, MessageImplementation>> = {
  MailtoMessage: "mailto",
  SlackMessage: "slack",
  SlackBotMessage: "slackBot",
};

function enabledInstances(): MessageInstance[] {
  return enabledInstancesOf("Message").flatMap((instance) => {
    const implementation = implementationsByName[implementationOf(instance)?.name ?? ""];
    return implementation === undefined
      ? []
      : [{ id: instance.id, name: instance.name, implementation }];
  });
}

export function messageChannels(): MessageChannel[] {
  return enabledInstances().map(({ id, name, implementation }) => ({
    id,
    name,
    description: channelDescriptions[implementation],
    result: implementation === "slackBot" ? "sent" : "redirect",
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
  switch (subject.kind) {
    case "proposal":
      return resolveProposal(session, subject.id);
    case "overrule":
      return resolveRestriction(session, subject.id, "overrule");
    case "forbiddenAskers":
      return resolveRestriction(session, subject.id, "askers");
    case "project":
      return resolveProject(session, subject.id);
    case "listedItem":
      return resolveListedItem(session, subject.id);
  }
}

function resolveProposal(session: Session, documentId: string): ResolvedSubject | null {
  const row = findReachableRow(session, documentId);
  if (row === null) {
    return null;
  }

  const { document } = row.record;
  const projectNames = projectIdsOf(row).flatMap(
    (projectId) => database.projects.find((project) => project.id === projectId)?.name ?? [],
  );
  return {
    label: `${document.title} · ${documentIdentifierOf(document)}`,
    path: `${pathOf("requests")}?id=${encodeURIComponent(document.id)}`,
    context: [
      "Proposed for digitization",
      i18n.t("message.ask", { ns: "common", count: asksOf(row).length }),
      ...projectNames,
    ].join(" · "),
    // A proposal's message goes to its requesters (§3).
    recipientIds: askerIdsOf(row),
  };
}

// A forbidden item in the caller's custody: to whoever may overrule the rule, or to its askers
// (MSG-recipients).
function resolveRestriction(
  session: Session,
  iterationId: string,
  to: "overrule" | "askers",
): ResolvedSubject | null {
  const row = findReachableValidation(session, iterationId);
  const restriction = row?.iteration.restriction ?? null;
  if (row === null || row.review !== "Forbidden" || restriction === null) {
    return null;
  }

  const { document } = row;
  return {
    label: `${document.title} · ${documentIdentifierOf(document)}`,
    path: `${pathOf("validations")}?id=${encodeURIComponent(iterationId)}&review=Forbidden`,
    context: `Forbidden by ${restriction.rule}: ${restriction.internalText ?? restriction.publicText}`,
    recipientIds: to === "overrule" ? holdersOfPermission("restriction.overrule") : row.askerIds,
  };
}

// A project the caller can see: to its manager (MSG-recipients).
function resolveProject(session: Session, projectId: string): ResolvedSubject | null {
  const detail = findProjectDetail(session, projectId);
  if (detail === null) {
    return null;
  }

  const { project } = detail.row;
  return {
    label: project.name,
    path: `${pathOf("projects")}?id=${encodeURIComponent(project.id)}`,
    context: `Project · ${project.state}`,
    recipientIds: [project.managerId],
  };
}

// An item on a list, in a document the caller can see: to whoever made the list
// (MSG-recipients).
function resolveListedItem(session: Session, iterationId: string): ResolvedSubject | null {
  const iteration = database.iterations.find((candidate) => candidate.id === iterationId);
  const detail = iteration === undefined ? null : findDocumentDetail(session, iteration.documentId);
  const list = database.lists.find((candidate) => candidate.id === iteration?.listId);
  if (detail === null || list === undefined) {
    return null;
  }

  const { document } = detail.record;
  return {
    label: `${document.title} · ${documentIdentifierOf(document)}`,
    path: `${pathOf("documents")}?id=${encodeURIComponent(document.id)}`,
    context: `On the list ${list.name}`,
    recipientIds: [list.createdBy],
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
            reachable.length === 0 || instance.implementation === "slackBot"
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
  return instance.implementation === "slack" || instance.implementation === "slackBot"
    ? user.id in slackHandles
    : user.email !== null;
}

export function sendMessage(
  session: Session,
  subject: MessageSubject,
  channelId: string,
  text: string,
): Outcome<{ reachedIds: string[] }> {
  if (text.trim() === "") {
    return { refusal: { status: 422, message: "Write the message first" } };
  }
  const instance = enabledInstances().find((candidate) => candidate.id === channelId);
  if (instance === undefined || instance.implementation !== "slackBot") {
    return {
      refusal: { status: 422, code: "message.not_sending", message: "This instance redirects." },
    };
  }
  const resolved = resolveSubject(session, subject);
  if (resolved === null) {
    return { refusal: { status: 404, message: "Nothing to message about here" } };
  }
  const reachedIds = resolved.recipientIds
    .filter((userId) => userId !== session.user.id)
    .map((userId) => database.users.find((user) => user.id === userId))
    .filter(
      (user): user is User =>
        user !== undefined && user.kind === "person" && canReach(instance, user),
    )
    .map(({ id }) => id);
  if (reachedIds.length === 0) {
    return {
      refusal: {
        status: 422,
        code: "message.unreachable",
        message: "This instance reaches nobody.",
      },
    };
  }
  return { value: { reachedIds } };
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
