// Client wording for event codes (EVENT-wording).
import type { EventCode, EventEntry, HistoryCode } from "@vera/domain/events";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { joinDetails } from "@/lib/join-details";

const refName = (value: { name: string } | null | undefined) => value?.name ?? null;
const changeLine = (value: { from: unknown; to: unknown } | null | undefined) =>
  value ? `${String(value.from ?? "—")} → ${String(value.to)}` : null;

export function wordingOf(
  entry: EventEntry,
  nameOf: (userId: string) => string,
): { title: string; line: string | null } {
  const titles: Record<HistoryCode, string> = {
    "request.created": "Asked for",
    "request.approved": "Approved",
    "request.declined": "Declined",
    "request.held": "Held",
    "request.withdrawn": "Withdrawn",
    "request.ingest_retried": "Ingest retried",
    "iteration.ingested": "Ingested",
    "iteration.ingest_failed": "Ingest failed",
    "iteration.rechecked": "Rechecked",
    "iteration.page_count_entered": "Page count entered",
    "iteration.verdict_accepted": "Validation approved",
    "iteration.verdict_denied": "Validation denied",
    "iteration.verdict_revoked": "Validation revoked",
    "iteration.restricted": "Restricted",
    "iteration.restriction_overruled": "Restriction overruled",
    "iteration.reclassified": "Reclassified",
    "iteration.cancelled": "Cancelled",
    "iteration.not_digitizable": "Could not be digitized",
    "iteration.resumed": "Resumed",
    "iteration.listed": "Listed",
    "iteration.unlisted": "Taken off a list",
    "iteration.digitized": "Digitized",
    "iteration.published": "Published",
    "iteration.link_added": "Link added",
    "iteration.link_changed": "Link changed",
    "iteration.link_made_primary": "Primary link changed",
    "iteration.link_removed": "Link removed",
    "iteration.copy_found": "Copy found",
    "iteration.property_changed": "Property changed",
    "document.relinked": "Relinked",
    "document.property_changed": "Property changed",
    "document.registry_changed": "Registry changed",
    "list.created": "Created",
    "list.renamed": "Renamed",
    "list.dates_moved": "Dates moved",
    "list.members_changed": "Members moved",
    "list.started_early": "Started early",
    "list.marked_done": "Marked Done",
    "list.deleted": "Deleted",
    "project.created": "Created",
    "project.details_changed": "Details changed",
    "project.dates_changed": "Dates or target changed",
    "project.member_added": "Member added",
    "project.member_removed": "Member removed",
    "project.manager_changed": "Manager changed",
    "project.approved": "Approved",
    "project.rejected": "Rejected",
    "project.deleted": "Deleted",
  };
  let title = titles[entry.code];
  let line: string | null = null;
  if (entry.data === null) return { title, line };

  switch (entry.code) {
    case "request.held":
      title =
        entry.data.why === "copy_exists" ? "Held: a copy exists" : "Held: checks still running";
      break;
    case "iteration.restricted":
      title = `${entry.data.outcome === "forbidden" ? "Forbidden" : "Restricted"} by ${entry.data.rule.name}`;
      break;
    case "request.created":
      line = refName(entry.data.batch);
      break;
    case "request.approved":
      line = joinDetails([
        entry.data.isRescan ? "as a rescan" : null,
        entry.data.batchSize === null ? null : `${formatCount(entry.data.batchSize)} requests`,
      ]);
      break;
    case "request.declined":
      line = entry.data.batchSize === null ? null : `${formatCount(entry.data.batchSize)} requests`;
      break;
    case "request.ingest_retried":
      line = `attempt ${entry.data.attempt}`;
      break;
    case "iteration.ingest_failed":
      line = joinDetails([`attempt ${entry.data.attempt}`, entry.data.error]);
      break;
    case "iteration.rechecked":
      line = joinDetails([
        entry.data.by === "catalog_change" ? "after a catalog change" : null,
        `${formatCount(entry.data.found)} defects found, ${formatCount(entry.data.gone)} gone`,
      ]);
      break;
    case "iteration.page_count_entered":
      line = `${entry.data.previous ?? "—"} → ${entry.data.pages}`;
      break;
    case "iteration.verdict_accepted":
    case "iteration.verdict_denied":
    case "iteration.verdict_revoked":
      line =
        entry.data.defects.map((defect) => `${defect.instance.name} ${defect.rule}`).join(", ") ||
        null;
      break;
    case "iteration.restriction_overruled":
      line = refName(entry.data.rule);
      break;
    case "iteration.reclassified":
      line = joinDetails([changeLine(entry.data.category), changeLine(entry.data.priority)]);
      break;
    case "iteration.cancelled":
      line = entry.data.list ? `taken off ${entry.data.list.name}` : null;
      break;
    case "iteration.not_digitizable":
    case "iteration.listed":
    case "iteration.digitized":
      line = refName(entry.data.list);
      break;
    case "iteration.unlisted":
      line = joinDetails([
        refName(entry.data.list),
        entry.data.why === "list_deleted" ? "list deleted" : null,
      ]);
      break;
    case "iteration.published":
    case "iteration.link_added":
    case "iteration.link_made_primary":
    case "iteration.link_removed":
      line = entry.data.link.url;
      break;
    case "iteration.link_changed":
      line = changeLine(entry.data.url);
      break;
    case "iteration.copy_found":
      line = `${entry.data.registry}: ${entry.data.state}`;
      break;
    case "document.registry_changed":
      line = `${entry.data.registry}: ${String(entry.data.state.to)}`;
      break;
    case "iteration.property_changed":
    case "document.property_changed":
      line = `${entry.data.key}: ${changeLine(entry.data.value)}`;
      break;
    case "document.relinked":
      line = changeLine(entry.data.catalogId);
      break;
    case "list.created":
      line = joinDetails([
        entry.data.generator
          ? `generated by ${entry.data.generator.name} ${entry.data.generator.version}`
          : null,
        `${formatCount(entry.data.members)} members`,
      ]);
      break;
    case "list.renamed":
      line = changeLine(entry.data.name);
      break;
    case "list.dates_moved":
      line = joinDetails([
        formatCalendarDay(entry.data.starts.to),
        formatCalendarDay(entry.data.ends.to),
      ]);
      break;
    case "list.members_changed":
      line = `${formatCount(entry.data.added.length)} added, ${formatCount(entry.data.removed.length)} removed`;
      break;
    case "list.started_early":
      line = `was to start ${formatCalendarDay(entry.data.starts)}`;
      break;
    case "list.marked_done":
      line = `${formatCount(entry.data.digitized)} digitized`;
      break;
    case "list.deleted":
      line = `${formatCount(entry.data.returned)} back in the pool`;
      break;
    case "project.member_added":
    case "project.member_removed":
      line = nameOf(entry.data.userId);
      break;
    case "project.manager_changed":
      line = nameOf(entry.data.userId.to);
      break;
    case "project.approved":
      line = `${formatCount(entry.data.approved)} proposals approved`;
      break;
    case "project.rejected":
      line = `${formatCount(entry.data.declined)} declined`;
      break;
    case "project.details_changed":
    case "project.dates_changed":
      line =
        entry.data.changes
          .map((change) => `${change.field}: ${String(change.from)} → ${String(change.to)}`)
          .join(", ") || null;
      break;
  }
  return { title, line };
}

const publicWords: Partial<Record<EventCode, string>> = {
  "request.created": "Asked",
  "request.approved": "Accepted",
  "request.declined": "Not accepted",
  "request.withdrawn": "Withdrawn",
  "iteration.restricted": "Not available for digitization",
  "iteration.cancelled": "On hold",
  "iteration.not_digitizable": "Could not be digitized",
  "iteration.digitized": "Digitized",
  "iteration.published": "Available to read",
};
export function publicWordingOf(code: EventCode): string {
  return publicWords[code] ?? "";
}
