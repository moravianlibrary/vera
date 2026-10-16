// Where a reader opens a scan (ACT-publish; PLG-kinds Link and Publication detector). *Set link…*
// takes a web address or a PID: each enabled Link instance reads what it recognises, and the first
// that does gives the canonical link; without one only a web address is taken, as typed. A
// Publication detector finds digitized items its repository now publishes and sets their links
// as its agent, logged as *Set link…* is.

import { categoryPathOf } from "@vera/domain/categories";
import type { Actor, Iteration } from "@vera/domain/entities";
import { database } from "@/mocks/database";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import { recordHookEvent } from "@/mocks/hooks";
import { replaceIteration, writeLog } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";

// The agent a Publication detector acts as.
export const publicationDetectorAgentId = "a3";

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
  if (base === "" || pid === undefined) {
    return null;
  }

  const isPid = typed === pid;
  const isItsViewer = typed.startsWith(`${base}/`);
  return isPid || isItsViewer ? `${base}/uuid/${pid.toLowerCase()}` : null;
}

function readBy(instance: StoredPluginInstance, typed: string): string | null {
  return implementationOf(instance)?.name === "KrameriusLink"
    ? krameriusLinkOf(instance, typed)
    : null;
}

// The canonical link for what was typed; null when nothing reads it and it is no web address.
export function canonicalLinkOf(typed: string): string | null {
  const text = typed.trim();
  for (const instance of enabledInstancesOf("Link")) {
    const link = readBy(instance, text);
    if (link !== null) {
      return link;
    }
  }

  return isWebAddress(text) ? text : null;
}

// Published, or the link changed: logged and announced the same whoever set it.
export function setLink(iteration: Iteration, link: string, actor: Actor): void {
  replaceIteration({ ...iteration, publishedLink: link, progress: "Published" });
  const isChange = iteration.publishedLink !== null;
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor,
    correlationId: crypto.randomUUID(),
    event: isChange ? "Link changed" : "Published",
    detail: isChange ? `From ${iteration.publishedLink} to ${link}.` : link,
  });
  recordHookEvent(
    "iteration.published",
    iteration.id,
    "",
    `${iteration.id} is published at ${link}`,
    {
      categoryPath: categoryPathOf(database.categories, iteration.categoryId).map(
        (category) => category.name,
      ),
    },
  );
}

// The PID the mock's repository gives an item, so the same item is always found at one place.
function pidOf(iteration: Iteration): string {
  const digits = [...iteration.id]
    .map((character) => character.charCodeAt(0).toString(16))
    .join("")
    .padStart(12, "0")
    .slice(-12);
  return `uuid:00000000-0000-4000-8000-${digits}`;
}

// What a detector's run finds: every digitized item with no link yet, published at the PID its
// repository gave it, read by the Link instances as a typed PID would be.
export function detectPublications(): Iteration[] {
  const found = database.iterations.filter(
    (iteration) => iteration.progress === "Digitized" && iteration.publishedLink === null,
  );
  return found.flatMap((iteration) => {
    const link = canonicalLinkOf(pidOf(iteration));
    if (link === null) {
      return [];
    }

    setLink(iteration, link, { kind: "user", userId: publicationDetectorAgentId });
    return [iteration];
  });
}
