// One iteration beside the Documents Validations list (page-validation.js render): a note on what
// holds it, the facts, then the cards. One Defects card holds every finding in sections divided
// by a rule (decided 2026-10-06): outstanding, D \ A, with Accept, Deny… and Recheck; denied, the
// ones ruled substantial, which lapse once gone; accepted, with who and when, and Revoke. Nothing
// is corrected here: the catalog record links out, the curator repairs it there, and Recheck
// reads it again; only a page count is entered here. Reclassify and Cancel… sit in More ▾
// (validation-actions.tsx). A forbidden item says what the rule said and offers *Message
// admins…*. Then the attempt, the catalog record and the history.
// TODO(rrandiak): labels move to i18n.

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
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";
import { plural } from "@/lib/plural";

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
          label: `Open in ${documents.visibleLabel}`,
          href: `${documents.path}?id=${encodeURIComponent(document.id)}`,
        };
  const onRechecked = (result: RecheckResult) => {
    if (result.review === null) {
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "green",
        heading: "Rechecked",
        summary: joinDetails([
          "The checks found nothing left to rule on",
          result.progress === "Ready" ? "it is Ready" : null,
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
        heading: "Handed over",
        summary:
          "Reclassified into a category outside your custody; whoever holds it reviews it now",
        next,
      }),
    onCancelled: (askerCount) =>
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "slate",
        heading: "Cancelled",
        summary: joinDetails([
          "Held where it was; it stays in Documents, with Resume",
          askerCount === 1 ? "the asker is told" : `all ${askerCount} askers are told`,
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
      label: "Ask to overrule…",
      onSelect: () => setMessaging("overrule"),
    });
  }

  if (canMessage && row.askerIds.length > 0) {
    headingActions.push({
      id: "message-askers",
      label: "Message askers…",
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
        <ActionBar actions={headingActions} menuLabel="More" className="mb-4" />
      </div>
      <ReviewNote row={row} nameOf={nameOf} />
      <ReviewFacts row={row} nameOf={nameOf} />

      <div className="mt-4 grid gap-4">
        {row.review !== "Forbidden" && (
          <DetailCard title="Defects">
            {lastRecheck !== null && <RecheckNote {...lastRecheck} />}
            {row.review === "Needed" && (
              <DefectSection title={`Outstanding — ${outstandingDefects(iteration).length}`}>
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
              <DefectSection title={`Denied — ${deniedDefectsOf(iteration).length}`}>
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
        <HistoryCard
          record={{ document, iterations: [iteration], requests: [] }}
          log={log}
          nameOf={nameOf}
          isPublic={false}
        />
      </div>

      {more.dialogs}
      <MessageDialog
        isOpen={messaging !== null}
        onClose={() => setMessaging(null)}
        subject={{ kind: messaging ?? "overrule", id: iteration.id }}
        label={document.title}
        recipientLabel={messaging === "forbiddenAskers" ? "who asked" : "who may overrule it"}
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
  const cleared = defects.filter((defect) => result.clearedKeys.includes(defect.key));
  if (cleared.length === 0) {
    return (
      <StatusNote tone="amber" className="mb-3" title="Rechecked: nothing changed">
        The catalog record still gives the same findings. Repair it in the catalog first.
      </StatusNote>
    );
  }

  return (
    <StatusNote tone="green" className="mb-3" title="Rechecked">
      The checks no longer find {cleared.map(defectNameOf).join(", ")}; the rest are still there.
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
  const { iteration } = row;

  if (row.review === "Forbidden" && iteration.restriction !== null) {
    const { restriction } = iteration;
    return (
      <StatusNote
        tone="red"
        className="mb-4"
        title={`Forbidden by ${restriction.rule}, ${formatDay(restriction.foundAt)}`}
      >
        {restriction.internalText !== null && `${restriction.internalText} `}
        Askers read: “{restriction.publicText}”
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
            ? "Denied in review"
            : `Denied in review by ${nameOf(denial.actorId)}, ${formatDay(denial.at)}`
        }
      >
        {denial?.note && `${denial.note} `}
        {denial?.publicText && `They were told: “${denial.publicText}” `}
        Over {deniedDefectsOf(iteration).map(defectNameOf).join(", ")}. The denial lapses on its own
        once the defect is gone — repair it in the catalog, then Recheck.
      </StatusNote>
    );
  }

  if (row.review === "Needed" && isFoundAfterScan(iteration)) {
    return (
      <StatusNote tone="purple" className="mb-4" title={`${iteration.progress} · review needed`}>
        Found after the scan exists, so progress does not move back. Accepting records it as
        tolerable; denying marks it {iteration.progress} · denied in review.
      </StatusNote>
    );
  }

  if (row.review === "Approved") {
    return (
      <StatusNote tone="green" className="mb-4" title="Accepted">
        Every current defect has been ruled tolerable. Revoking returns it to the queue.
      </StatusNote>
    );
  }

  return null;
}

function ReviewFacts({ row, nameOf }: RowProps) {
  const { iteration } = row;
  const outstanding = outstandingDefects(iteration);
  const acceptedCount = acceptedDefectsOf(iteration).length;
  const [firstAskerId] = row.askerIds;
  const lastOf = (verdict: "Approved" | "Denied") =>
    iteration.verdicts.findLast((entry) => entry.verdict === verdict);

  const third = () => {
    if (row.review === "Forbidden") {
      return {
        label: "Forbidden since",
        value: formatDay(row.waitingSince),
        foot: "by a rule, never a person",
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
        label: row.review === "Denied" ? "Denied" : "Accepted",
        value: formatDay(verdict.at),
        foot: `by ${nameOf(verdict.actorId)}`,
        isText: true,
      };
    }

    return {
      label: "Waiting since",
      value: formatDay(row.waitingSince),
      foot: firstAskerId === undefined ? undefined : `asked by ${nameOf(firstAskerId)}`,
      isText: true,
    };
  };

  return (
    <StatTiles
      stats={[
        { label: "Status", value: <IterationStatus row={row} />, isText: true },
        {
          label: "Outstanding",
          value: row.review === "Forbidden" ? "—" : outstanding.length,
          foot:
            row.review === "Forbidden"
              ? "not reviewed while forbidden"
              : acceptedCount > 0
                ? `${acceptedCount} already accepted`
                : "nothing accepted yet",
        },
        third(),
      ]}
    />
  );
}

// A ∩ D, each with who accepted it and when. While new defects wait, these are not asked again.
function AcceptedSection({ row, nameOf, action }: RowProps & { action: ReactNode }) {
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
    <DefectSection title={`Accepted — ${accepted.length}`} action={action}>
      <div>
        {accepted.map((defect) => {
          const acceptance = acceptanceOf(defect);
          return (
            <DefectRow
              key={defect.key}
              defect={defect}
              aside={
                acceptance === undefined
                  ? "accepted"
                  : `accepted by ${nameOf(acceptance.actorId)}, ${formatDay(acceptance.at)}`
              }
            >
              {acceptance?.note && (
                <p className="mt-1 text-xs text-muted-foreground">Note: “{acceptance.note}”</p>
              )}
            </DefectRow>
          );
        })}
      </div>
      {row.review === "Needed" && (
        <FinePrint>
          Not asked again: the last check found {accepted.length === 1 ? "it" : "them"} unchanged.
          Only what is new is outstanding.
        </FinePrint>
      )}
    </DefectSection>
  );
}

// The attempt under review: where it is filed and how far it has come.
function AttemptCard({ row }: { row: ValidationRow }) {
  const { iteration } = row;
  const { data: categories = [] } = useCategoriesQuery();

  return (
    <DetailCard title="This attempt">
      <FactGrid
        facts={[
          { label: "Category", value: categoryLabelOf(categories, iteration.categoryId) },
          { label: "Priority", value: <PriorityBadge priority={iteration.priority} /> },
          { label: "Progress", value: iteration.progress },
          { label: "Asked by", value: plural(row.askerIds.length, "person", "people") },
        ]}
      />
    </DetailCard>
  );
}
