// Client wording for event codes (EVENT-wording).
import type { EventCode, EventEntry } from "@vera/domain/events";
import { i18n } from "@/i18n";
import { formatCalendarDay, formatLongCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { joinDetails } from "@/lib/join-details";

const refName = (value: { name: string } | null | undefined) => value?.name ?? null;
const changeLine = (value: { from: unknown; to: unknown } | null | undefined) =>
  value
    ? i18n.t("change", {
        ns: "history",
        from: String(value.from ?? "—"),
        to: String(value.to),
      })
    : null;

export function wordingOf(
  entry: EventEntry,
  nameOf: (userId: string) => string,
): { title: string; line: string | null } {
  let title = i18n.t(entry.code, { ns: "history" });
  let line: string | null = null;
  if (entry.data === null) return { title, line };

  switch (entry.code) {
    case "request.held":
      title = i18n.t(
        entry.data.why === "copy_exists" ? "request.held.copyExists" : "request.held.checksRunning",
        { ns: "history" },
      );
      break;
    case "iteration.restricted":
      title = i18n.t("iteration.restricted.by", {
        ns: "history",
        restriction: i18n.t(
          entry.data.outcome === "forbidden"
            ? "iteration.restricted.forbidden"
            : "iteration.restricted.restricted",
          { ns: "history" },
        ),
        rule: entry.data.rule.name,
      });
      break;
    case "request.created":
      line = refName(entry.data.batch);
      break;
    case "request.approved":
      line = joinDetails([
        entry.data.isRescan ? i18n.t("request.rescan", { ns: "history" }) : null,
        entry.data.batchSize === null
          ? null
          : i18n.t("request.count", {
              ns: "history",
              count: entry.data.batchSize,
              formatted: formatCount(entry.data.batchSize),
            }),
        entry.data.suggestion === null
          ? null
          : i18n.t(
              entry.data.suggestion.kept
                ? "request.suggestion.kept"
                : "request.suggestion.overruled",
              {
                ns: "history",
                classifier: entry.data.suggestion.classifier.name,
                category: entry.data.suggestion.category.name,
              },
            ),
      ]);
      break;
    case "request.declined":
      line =
        entry.data.batchSize === null
          ? null
          : i18n.t("request.count", {
              ns: "history",
              count: entry.data.batchSize,
              formatted: formatCount(entry.data.batchSize),
            });
      break;
    case "request.ingest_retried":
      line = i18n.t("attempt", { ns: "history", count: entry.data.attempt });
      break;
    case "iteration.ingest_failed":
      line = joinDetails([
        i18n.t("attempt", { ns: "history", count: entry.data.attempt }),
        entry.data.error,
      ]);
      break;
    case "iteration.rechecked":
      line = joinDetails([
        entry.data.by === "catalog_change"
          ? i18n.t("iteration.rechecked.catalogChange", { ns: "history" })
          : null,
        i18n.t("iteration.rechecked.count", {
          ns: "history",
          found: formatCount(entry.data.found),
          gone: formatCount(entry.data.gone),
          count: entry.data.found,
        }),
      ]);
      break;
    case "iteration.page_count_entered":
      line = i18n.t("change", {
        ns: "history",
        from: String(entry.data.previous ?? "—"),
        to: String(entry.data.pages),
      });
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
      line = entry.data.list
        ? i18n.t("iteration.cancelled.list", { ns: "history", list: entry.data.list.name })
        : null;
      break;
    case "iteration.not_digitizable":
    case "iteration.listed":
    case "iteration.digitized":
      line = refName(entry.data.list);
      break;
    case "iteration.unlisted":
      line = joinDetails([
        refName(entry.data.list),
        entry.data.why === "list_deleted"
          ? i18n.t("iteration.unlisted.deleted", { ns: "history" })
          : null,
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
      line = i18n.t("iteration.copyFound", {
        ns: "history",
        registry: entry.data.registry,
        state: entry.data.state,
      });
      break;
    case "document.registry_changed":
      line = i18n.t("document.registryChanged", {
        ns: "history",
        registry: entry.data.registry,
        state: String(entry.data.state.to),
      });
      break;
    case "iteration.property_changed":
    case "document.property_changed":
      line = i18n.t("property.changed", {
        ns: "history",
        key: entry.data.key,
        change: changeLine(entry.data.value),
      });
      break;
    case "document.relinked":
      line = changeLine(entry.data.catalogId);
      break;
    case "list.created":
      line = joinDetails([
        entry.data.generator
          ? i18n.t("list.generatedBy", {
              ns: "history",
              name: entry.data.generator.name,
              version: entry.data.generator.version,
            })
          : null,
        i18n.t("list.members", {
          ns: "history",
          count: entry.data.members,
          formatted: formatCount(entry.data.members),
        }),
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
      line = i18n.t("list.membersChanged", {
        ns: "history",
        added: entry.data.added.length,
        removed: entry.data.removed.length,
      });
      break;
    case "list.started_early":
      line = i18n.t("list.startedEarly", {
        ns: "history",
        day: formatLongCalendarDay(entry.data.starts),
      });
      break;
    case "list.marked_done":
      line = i18n.t("list.digitized", {
        ns: "history",
        count: entry.data.digitized,
        formatted: formatCount(entry.data.digitized),
      });
      break;
    case "list.deleted":
      line = i18n.t("list.returned", {
        ns: "history",
        count: entry.data.returned,
        formatted: formatCount(entry.data.returned),
      });
      break;
    case "project.member_added":
    case "project.member_removed":
      line = nameOf(entry.data.userId);
      break;
    case "project.manager_changed":
      line = nameOf(entry.data.userId.to);
      break;
    case "project.approved":
      line = i18n.t("project.approvedCount", {
        ns: "history",
        count: entry.data.approved,
        formatted: formatCount(entry.data.approved),
      });
      break;
    case "project.rejected":
      line = i18n.t("project.rejectedCount", {
        ns: "history",
        count: entry.data.declined,
        formatted: formatCount(entry.data.declined),
      });
      break;
    case "project.details_changed":
    case "project.dates_changed":
      line =
        entry.data.changes
          .map((change) =>
            i18n.t("project.change", {
              ns: "history",
              field: change.field,
              from: String(change.from),
              to: String(change.to),
            }),
          )
          .join(", ") || null;
      break;
  }
  return { title, line };
}

export function publicWordingOf(code: EventCode): string {
  return i18n.t(`${code}.public`, { ns: "history", defaultValue: "" });
}
