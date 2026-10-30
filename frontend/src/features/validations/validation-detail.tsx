// One iteration beside the Documents Validations list (page-validation.js render): a note on what
// holds it, the facts, then the cards. One Defects card holds every finding in sections divided
// by a rule (decided 2026-10-06): outstanding, D \ A, with Accept, Deny… and Recheck; denied, the
// ones ruled substantial, which lapse once gone; accepted, with who and when, and Revoke. Nothing
// is corrected here: the catalog record links out, the curator repairs it there, and Recheck
// reads it again; only a page count is entered here. Reclassify and Cancel… sit in More ▾
// (validation-actions.tsx). A forbidden item says what the rule said and offers *Message
// admins…*. Then the attempt, the catalog record and the history.

import type { RecheckResult } from "@vera/contract/iterations";
import type { ValidationDetail } from "@vera/contract/validations";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Defect, Session } from "@vera/domain/entities";
import { scopeOfIteration } from "@vera/domain/iterations";
import { can } from "@vera/domain/permissions";
import { outstandingDefects } from "@vera/domain/status";
import type { ValidationRow } from "@vera/domain/validations";
import {
  acceptedDefectsOf,
  defectNameOf,
  deniedDefectsOf,
  isFoundAfterScan,
  pagesSubject,
} from "@vera/domain/validations";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { categoryLabelOf } from "@/components/classification-fields";
import { DetailCard, FactGrid, FinePrint, StatTiles } from "@/components/detail-card";
import { MessageDialog } from "@/components/dialogs/message-dialog";
import { visibleNavigation } from "@/components/layout/navigation";
import type { Outcome } from "@/components/pane-state";
import { CatalogCard, HistoryCard, RecordHeading } from "@/components/record-cards";
import { PriorityBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { PropertiesCard } from "@/features/properties/properties-card";
import { DefectRow, PageCountEntry } from "@/features/validations/defect-card";
import {
  ForbiddenCard,
  RecheckButton,
  RevokeButton,
  useMoreActions,
  VerdictControls,
} from "@/features/validations/validation-actions";
import { IterationStatus } from "@/features/validations/validation-list";
import { useMessageChannelsQuery } from "@/hooks/use-message-query";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";

// What the pane says once an act has taken the item out of the view.
export interface LeftOutcome extends Outcome {
  iterationId: string;
}

interface ValidationDetailPaneProps {
  detail: ValidationDetail;
  session: Session;
  onLeft: (outcome: LeftOutcome) => void;
}

export function ValidationDetailPane({ detail, session, onLeft }: ValidationDetailPaneProps) {
  const { t } = useTranslation("validations");
  const { row, log } = detail;
  const { document, iteration } = row;
  const { data: categories = [] } = useCategoriesQuery();
  const { data: users = [] } = useUsersQuery();
  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const documents = visibleNavigation(session).find((entry) => entry.id === "documents");
  const [messaging, setMessaging] = useState<"overrule" | "forbiddenAskers" | null>(null);
  const { data: messageChannels = [] } = useMessageChannelsQuery();
  // What the last recheck found, until another item is opened.
  const [lastRecheck, setLastRecheck] = useState<LastRecheck | null>(null);

  const scope = scopeOfIteration(categories, iteration.categoryId);
  // A page count is entered here until the scan has counted the pages; entering it rechecks.
  const mayEnterPages = can(session, "iteration.recheck", scope) && !isFoundAfterScan(iteration);
  const next =
    documents === undefined
      ? undefined
      : {
          label: t("detail.openDocuments", { label: documents.visibleLabel }),
          href: `${documents.path}?id=${encodeURIComponent(document.id)}`,
        };
  const onRechecked = (result: RecheckResult) => {
    if (result.review === null) {
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "green",
        heading: t("decision.rechecked"),
        summary: joinDetails([
          t("detail.checksClear"),
          result.progress === "Ready" ? t(`progress.${result.progress}`) : null,
        ]),
        next,
      });
      return;
    }

    setLastRecheck({ defects: iteration.defects, result });
  };

  const more = useMoreActions({
    row,
    scope,
    session,
    onHandedOver: () =>
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "slate",
        heading: t("detail.handedOver"),
        summary: t("detail.handedOverSummary"),
        next,
      }),
    onCancelled: (askerCount) =>
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "slate",
        heading: t("decision.cancelled"),
        summary: joinDetails([
          t("detail.cancelledSummary"),
          t(askerCount === 1 ? "detail.askerTold_one" : "detail.askerTold_other", {
            count: askerCount,
          }),
        ]),
        next,
      }),
  });

  // A forbidden item reaches those who may overrule it, unless the caller is one, and its askers
  // (MSG-recipients). Neither needs a permission of its own, only an enabled Message instance
  // (MSG-order).
  const headingActions: ViewAction[] = [];
  const canMessage = row.review === "Forbidden" && messageChannels.length > 0;
  if (canMessage && !can(session, "restriction.overrule", scope)) {
    headingActions.push({
      id: "ask-to-overrule",
      label: t("detail.askOverrule"),
      onSelect: () => setMessaging("overrule"),
    });
  }

  if (canMessage && row.askerIds.length > 0) {
    headingActions.push({
      id: "message-askers",
      label: t("detail.messageAskers"),
      onSelect: () => setMessaging("forbiddenAskers"),
    });
  }

  if (next !== undefined) {
    headingActions.push({ id: "documents", label: `${next.label} →`, href: next.href });
  }

  headingActions.push(...more.actions);

  const recheck = (
    <RecheckButton row={row} scope={scope} session={session} onRechecked={onRechecked} />
  );
  const pageCountOf = (defect: Defect) =>
    defect.subject === pagesSubject && mayEnterPages ? (
      <PageCountEntry iteration={iteration} onRechecked={onRechecked} />
    ) : null;

  return (
    <article className="@container max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[categoryLabelOf(categories, iteration.categoryId)]}
        />
        <ActionBar actions={headingActions} menuLabel={t("detail.more")} className="mb-4" />
      </div>
      <ReviewNote row={row} nameOf={nameOf} />
      <ReviewFacts row={row} nameOf={nameOf} />

      <div className="mt-4 grid gap-4">
        {row.review !== "Forbidden" && (
          <DetailCard title={t("column.defects")}>
            {lastRecheck !== null && <RecheckNote {...lastRecheck} />}
            {row.review === "Needed" && (
              <DefectSection
                title={t("detail.outstandingCount", {
                  count: outstandingDefects(iteration).length,
                })}
              >
                <div>
                  {outstandingDefects(iteration).map((defect) => (
                    <DefectRow key={defect.key} defect={defect}>
                      {pageCountOf(defect)}
                    </DefectRow>
                  ))}
                </div>
                <VerdictControls row={row} scope={scope} session={session} recheck={recheck} />
              </DefectSection>
            )}
            {row.review === "Denied" && (
              <DefectSection
                title={t("detail.deniedCount", { count: deniedDefectsOf(iteration).length })}
              >
                <div>
                  {deniedDefectsOf(iteration).map((defect) => (
                    <DefectRow key={defect.key} defect={defect}>
                      {pageCountOf(defect)}
                    </DefectRow>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  {recheck}
                </div>
              </DefectSection>
            )}
            <AcceptedSection
              row={row}
              nameOf={nameOf}
              action={<RevokeButton row={row} scope={scope} session={session} />}
            />
            <FinePrint>
              Repair the record in the catalog, then Recheck: a defect that is gone needs no
              verdict. Accepting says it is tolerable — a later check finding the same or fewer asks
              nobody again.
            </FinePrint>
          </DetailCard>
        )}
        {row.review === "Forbidden" && <ForbiddenCard session={session} />}
        <AttemptCard row={row} />
        <CatalogCard document={document} nameOf={nameOf} link={detail.catalogLink} />
        <PropertiesCard
          record={{ document, iterations: [iteration], requests: [] }}
          audience="staff"
          nameOf={nameOf}
        />
        <HistoryCard log={log} nameOf={nameOf} isPublic={false} />
      </div>

      {more.dialogs}
      <MessageDialog
        isOpen={messaging !== null}
        onClose={() => setMessaging(null)}
        subject={{ kind: messaging ?? "overrule", id: iteration.id }}
        label={document.title}
        recipientLabel={t(
          messaging === "forbiddenAskers" ? "detail.whoAsked" : "detail.whoMayOverrule",
        )}
      />
    </article>
  );
}

interface LastRecheck {
  // The defects before it ran.
  defects: readonly Defect[];
  result: RecheckResult;
}

// What the checks found when they ran again, while something is still left to rule on.
function RecheckNote({ defects, result }: LastRecheck) {
  const { t } = useTranslation("validations");
  const references = useReferenceLabels(["pluginInstances"]);
  const cleared = defects.filter((defect) => result.clearedKeys.includes(defect.key));
  if (cleared.length === 0) {
    return (
      <StatusNote tone="amber" className="mb-3" title={t("detail.recheckedNoChange")}>
        {t("detail.sameFindings")}
      </StatusNote>
    );
  }

  return (
    <StatusNote tone="green" className="mb-3" title={t("decision.rechecked")}>
      {t("detail.checksNoLongerFind")}{" "}
      {cleared.map((defect) => defectNameOf(defect, references.pluginInstances)).join(", ")}; the
      {t("detail.restRemain")}
    </StatusNote>
  );
}

// A part of the Defects card, divided from the one above it by a rule.
function DefectSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 border-t pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- the record

interface RowProps {
  row: ValidationRow;
  nameOf: (userId: string) => string;
}

function ReviewNote({ row, nameOf }: RowProps) {
  const { t } = useTranslation("validations");
  const references = useReferenceLabels(["pluginInstances"]);
  const { iteration } = row;

  if (row.review === "Forbidden" && iteration.restriction !== null) {
    const { restriction } = iteration;
    return (
      <StatusNote
        tone="red"
        className="mb-4"
        title={t("detail.forbiddenBy", {
          rule: restriction.rule,
          date: formatDay(restriction.foundAt),
        })}
      >
        {restriction.internalText !== null && `${restriction.internalText} `}
        {t("defect.askersRead")} “{restriction.publicText}”
      </StatusNote>
    );
  }

  if (row.review === "Denied") {
    const denial = iteration.verdicts.findLast((verdict) => verdict.verdict === "Denied");
    return (
      <StatusNote
        tone="red"
        className="mb-4"
        title={
          denial === undefined
            ? t("review.denied")
            : t("detail.deniedBy", { actor: nameOf(denial.actorId), date: formatDay(denial.at) })
        }
      >
        {denial?.note && `${denial.note} `}
        {denial?.publicText && `${t("detail.theyWereTold")}: “${denial.publicText}” `}
        {t("detail.over")}{" "}
        {deniedDefectsOf(iteration)
          .map((defect) => defectNameOf(defect, references.pluginInstances))
          .join(", ")}
        . {t("detail.denialLapses")}
      </StatusNote>
    );
  }

  if (row.review === "Needed" && isFoundAfterScan(iteration)) {
    return (
      <StatusNote
        tone="purple"
        className="mb-4"
        title={t("detail.progressReviewNeeded", { progress: t(`progress.${iteration.progress}`) })}
      >
        {t("detail.foundAfterScan", { progress: t(`progress.${iteration.progress}`) })}
      </StatusNote>
    );
  }

  if (row.review === "Approved") {
    return (
      <StatusNote tone="green" className="mb-4" title={t("review.accepted")}>
        {t("detail.allDefectsAccepted")}
      </StatusNote>
    );
  }

  return null;
}

function ReviewFacts({ row, nameOf }: RowProps) {
  const { t } = useTranslation("validations");
  const { iteration } = row;
  const outstanding = outstandingDefects(iteration);
  const acceptedCount = acceptedDefectsOf(iteration).length;
  const [firstAskerId] = row.askerIds;
  const lastOf = (verdict: "Approved" | "Denied") =>
    iteration.verdicts.findLast((entry) => entry.verdict === verdict);

  const third = () => {
    if (row.review === "Forbidden") {
      return {
        label: t("detail.forbiddenSince"),
        value: formatDay(row.waitingSince),
        foot: t("detail.byRule"),
        isText: true,
      };
    }

    const verdict =
      row.review === "Denied"
        ? lastOf("Denied")
        : row.review === "Approved"
          ? lastOf("Approved")
          : undefined;
    if (verdict !== undefined) {
      return {
        label: t(row.review === "Denied" ? "decision.denied" : "review.accepted"),
        value: formatDay(verdict.at),
        foot: t("detail.byActor", { actor: nameOf(verdict.actorId) }),
        isText: true,
      };
    }

    return {
      label: t("filter.waitingSince"),
      value: formatDay(row.waitingSince),
      foot:
        firstAskerId === undefined
          ? undefined
          : t("detail.askedBy", { actor: nameOf(firstAskerId) }),
      isText: true,
    };
  };

  return (
    <StatTiles
      stats={[
        { label: t("column.status"), value: <IterationStatus row={row} />, isText: true },
        {
          label: t("detail.outstanding"),
          value: row.review === "Forbidden" ? "—" : outstanding.length,
          foot:
            row.review === "Forbidden"
              ? t("detail.notReviewedForbidden")
              : acceptedCount > 0
                ? t("detail.alreadyAccepted", { count: acceptedCount })
                : t("detail.nothingAccepted"),
        },
        third(),
      ]}
    />
  );
}

// A ∩ D, each with who accepted it and when. While new defects wait, these are not asked again.
function AcceptedSection({ row, nameOf, action }: RowProps & { action: ReactNode }) {
  const { t } = useTranslation("validations");
  const { iteration } = row;
  const accepted = acceptedDefectsOf(iteration);
  if (accepted.length === 0) {
    return null;
  }

  const acceptanceOf = (defect: Defect) =>
    iteration.verdicts.findLast(
      (verdict) => verdict.verdict === "Approved" && verdict.defectKeys.includes(defect.key),
    );

  return (
    <DefectSection title={t("detail.acceptedCount", { count: accepted.length })} action={action}>
      <div>
        {accepted.map((defect) => {
          const acceptance = acceptanceOf(defect);
          return (
            <DefectRow
              key={defect.key}
              defect={defect}
              aside={
                acceptance === undefined
                  ? t("review.accepted")
                  : t("detail.acceptedBy", {
                      actor: nameOf(acceptance.actorId),
                      date: formatDay(acceptance.at),
                    })
              }
            >
              {acceptance?.note && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("action.note")}: “{acceptance.note}”
                </p>
              )}
            </DefectRow>
          );
        })}
      </div>
      {row.review === "Needed" && (
        <FinePrint>
          {t(accepted.length === 1 ? "detail.notAskedAgain_one" : "detail.notAskedAgain_other")}
        </FinePrint>
      )}
    </DefectSection>
  );
}

// The attempt under review: where it is filed and how far it has come.
function AttemptCard({ row }: { row: ValidationRow }) {
  const { t } = useTranslation("validations");
  const { iteration } = row;
  const { data: categories = [] } = useCategoriesQuery();

  return (
    <DetailCard title={t("detail.thisAttempt")}>
      <FactGrid
        facts={[
          { label: t("filter.category"), value: categoryLabelOf(categories, iteration.categoryId) },
          { label: t("filter.priority"), value: <PriorityBadge priority={iteration.priority} /> },
          { label: t("detail.progress"), value: t(`progress.${iteration.progress}`) },
          {
            label: t("detail.askedByLabel"),
            value: t("count.people", { count: row.askerIds.length }),
          },
        ]}
      />
    </DetailCard>
  );
}
