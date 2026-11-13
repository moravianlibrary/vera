// Where a reader opens the scan. Link instances read what was typed; people add, replace, remove
// and choose a primary from the set; a Publication detector only adds as its agent, never twice
// the same address.

import type { Actor, Iteration, PublicationLink } from "@vera/domain/entities";
import { database } from "@/mocks/database";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import { recordHookEvent } from "@/mocks/hooks";
import { replaceIteration, writeLog } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";

export const publicationDetectorAgentId = "a3";
// The Publication detector acts as its agent, not as the curator who digitized the item.
const pidPattern = /uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isWebAddress(typed: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(typed).protocol);
  } catch {
    return false;
  }
}

// What a Kramerius Link reads: a PID, or an address of its own viewer, `…/view/uuid:X?page=…`,
// which becomes `…/uuid/uuid:X`.
function krameriusLinkOf(instance: StoredPluginInstance, typed: string): string | null {
  const base = (instance.configuration.base_url ?? "").replace(/\/+$/, "");
  const pid = typed.match(pidPattern)?.[0];
  if (base === "" || pid === undefined) return null;
  const isPid = typed === pid;
  const isItsViewer = typed.startsWith(`${base}/`);
  return isPid || isItsViewer ? `${base}/uuid/${pid.toLowerCase()}` : null;
}

function readBy(instance: StoredPluginInstance, typed: string): string | null {
  return implementationOf(instance)?.name === "KrameriusLink"
    ? krameriusLinkOf(instance, typed)
    : null;
}

// The canonical address and the Link instance that recognized it; an ordinary web address stays
// as typed with no instance.
export function canonicalLinkOf(typed: string): { url: string; instanceId: string | null } | null {
  const text = typed.trim();
  for (const instance of enabledInstancesOf("Link")) {
    const url = readBy(instance, text);
    if (url !== null) return { url, instanceId: instance.id };
  }
  return isWebAddress(text) ? { url: text, instanceId: null } : null;
}

function announce(
  iteration: Iteration,
  actor: Actor,
  code:
    | "iteration.published"
    | "iteration.link_added"
    | "iteration.link_changed"
    | "iteration.link_made_primary"
    | "iteration.link_removed",
  data: unknown,
  hook: "iteration.published" | "iteration.link_added" | "iteration.link_changed",
  link: string,
): void {
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor,
    correlationId: crypto.randomUUID(),
    code,
    data: data as never,
    reason: { public: null, internal: null },
  });
  const publicText =
    hook === "iteration.published"
      ? `${iteration.id} is published at ${link}`
      : hook === "iteration.link_added"
        ? `${iteration.id} has a new link at ${link}`
        : `${iteration.id}: its links changed`;
  recordHookEvent(hook, iteration.id, "", publicText);
}

function storedLink(
  link: { url: string; instanceId: string | null },
  actor: Actor,
  isPrimary: boolean,
  id = crypto.randomUUID(),
): PublicationLink {
  return {
    id,
    ...link,
    setBy: actor.kind === "user" ? actor.userId : publicationDetectorAgentId,
    setAt: new Date().toISOString(),
    isPrimary,
  };
}

// Adds a link; writes Published / iteration.published first, or Link added / iteration.link_added.
export function addLink(
  iteration: Iteration,
  link: { url: string; instanceId: string | null },
  actor: Actor,
): Iteration {
  const isFirst = iteration.links.length === 0;
  const added = storedLink(link, actor, isFirst);
  const next = { ...iteration, links: [...iteration.links, added], progress: "Published" as const };
  replaceIteration(next);
  announce(
    next,
    actor,
    isFirst ? "iteration.published" : "iteration.link_added",
    { link: { id: added.id, url: link.url } },
    isFirst ? "iteration.published" : "iteration.link_added",
    link.url,
  );
  return next;
}

// Replaces a link; writes Link changed / iteration.link_changed.
export function replaceLink(
  iteration: Iteration,
  linkId: string,
  link: { url: string; instanceId: string | null },
  actor: Actor,
): Iteration {
  const old = iteration.links.find((candidate) => candidate.id === linkId);
  if (old === undefined) return iteration;
  const next = {
    ...iteration,
    links: iteration.links.map((candidate) =>
      candidate.id === linkId
        ? {
            ...candidate,
            ...link,
            setBy: actor.kind === "user" ? actor.userId : publicationDetectorAgentId,
            setAt: new Date().toISOString(),
          }
        : candidate,
    ),
  };
  replaceIteration(next);
  announce(
    next,
    actor,
    "iteration.link_changed",
    { link: { id: old.id, url: link.url }, url: { from: old.url, to: link.url } },
    "iteration.link_changed",
    link.url,
  );
  return next;
}

// Makes a link primary; writes Primary link changed / iteration.link_changed.
export function makePrimary(iteration: Iteration, linkId: string, actor: Actor): Iteration {
  const link = iteration.links.find((candidate) => candidate.id === linkId);
  if (link === undefined) return iteration;
  const next = {
    ...iteration,
    links: iteration.links.map((candidate) => ({
      ...candidate,
      isPrimary: candidate.id === linkId,
    })),
  };
  replaceIteration(next);
  announce(
    next,
    actor,
    "iteration.link_made_primary",
    { link: { id: link.id, url: link.url } },
    "iteration.link_changed",
    link.url,
  );
  return next;
}

// Removes a link; writes Link removed / iteration.link_changed.
export function removeLink(iteration: Iteration, linkId: string, actor: Actor): Iteration {
  const removed = iteration.links.find((candidate) => candidate.id === linkId);
  if (removed === undefined) return iteration;
  let remaining = iteration.links.filter((candidate) => candidate.id !== linkId);
  if (removed.isPrimary && remaining.length) {
    const oldest = remaining.toSorted((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt))[0];
    if (oldest)
      remaining = remaining.map((candidate) => ({
        ...candidate,
        isPrimary: candidate.id === oldest.id,
      }));
  }
  const next = { ...iteration, links: remaining };
  replaceIteration(next);
  announce(
    next,
    actor,
    "iteration.link_removed",
    {
      link: { id: removed.id, url: removed.url },
      primary: remaining.find((candidate) => candidate.isPrimary)
        ? {
            id: remaining.find((candidate) => candidate.isPrimary)?.id ?? "",
            url: remaining.find((candidate) => candidate.isPrimary)?.url ?? "",
          }
        : null,
    },
    "iteration.link_changed",
    removed.url,
  );
  return next;
}

// The mock repository gives every iteration a stable PID.
function pidOf(iteration: Iteration): string {
  const digits = [...iteration.id]
    .map((character) => character.charCodeAt(0).toString(16))
    .join("")
    .padStart(12, "0")
    .slice(-12);
  return `uuid:00000000-0000-4000-8000-${digits}`;
}

// Finds Digitized or Published items and adds the detector's address unless it is already held.
export function detectPublications(instanceId: string): Iteration[] {
  const detector = database.pluginInstances.find((instance) => instance.id === instanceId);
  if (detector === undefined) return [];
  const found: Iteration[] = [];
  for (const iteration of database.iterations.filter(
    (item) => item.progress === "Digitized" || item.progress === "Published",
  )) {
    const canonical = canonicalLinkOf(pidOf(iteration));
    if (canonical === null || iteration.links.some((link) => link.url === canonical.url)) continue;
    const link = { ...canonical, instanceId };
    found.push(addLink(iteration, link, { kind: "user", userId: publicationDetectorAgentId }));
  }
  return found;
}
