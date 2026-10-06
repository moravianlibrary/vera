// One iteration beside the Documents Validations list (page-validation.js render): a note on what
// holds it, the facts, then the cards. The curator is shown D \ A only: the outstanding defects,
// each with its fix in place; a denied item shows the defects ruled substantial with theirs, since
// a denial lapses once its defect is gone; the defects already accepted sit in their own card,
// with who and when, and Revoke. Accept and Deny… close the outstanding card, Reclassify and
// Cancel… sit in More ▾ (validation-actions.tsx). A forbidden item says what the rule said and
// offers *Message admins…*. Then the attempt, the catalog record and the history.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useState } from "react";
import type { RecheckResult } from "@/api/iterations";
import type { ValidationDetail } from "@/api/validations";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { categoryLabelOf } from "@/components/classification-fields";
import {
  DetailCard,
  DetailRow,
  FactGrid,
  FinePrint,
  Muted,
  StatTiles,
} from "@/components/detail-card";
import { MessageDialog } from "@/components/dialogs/message-dialog";
import { visibleNavigation } from "@/components/layout/navigation";
import type { Outcome } from "@/components/pane-state";
import { CatalogCard, HistoryCard, RecordHeading } from "@/components/record-cards";
import { PriorityBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { documentIdentifierOf } from "@/domain/documents";
import type { Defect, Session } from "@/domain/entities";
import { scopeOfIteration } from "@/domain/iterations";
import { can } from "@/domain/permissions";
import { outstandingDefects } from "@/domain/status";
import type { ValidationRow } from "@/domain/validations";
import {
  acceptedDefectsOf,
  defectNameOf,
  deniedDefectsOf,
  fixOf,
  fixPermissionOf,
  isFoundAfterScan,
} from "@/domain/validations";
import { DefectCard } from "@/features/validations/defect-card";
import {
  ForbiddenCard,
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
  const [isMessaging, setIsMessaging] = useState(false);
  const { data: messageChannels = [] } = useMessageChannelsQuery();
  // What the last fix found, until another item is opened.
  const [lastFix, setLastFix] = useState<{ defect: Defect; result: RecheckResult } | null>(null);

  const scope = scopeOfIteration(categories, iteration.categoryId);
  // No fix in place once scanned: it goes to the catalog record (C10).
  const fixFor = (defect: Defect) => {
    const fix = fixOf(defect);
    return fix !== null && can(session, fixPermissionOf(fix), scope) && !isFoundAfterScan(iteration)
      ? fix
      : null;
  };
  const next =
    documents === undefined
      ? undefined
      : {
          label: `Open in ${documents.visibleLabel}`,
          href: `${documents.path}?id=${encodeURIComponent(document.id)}`,
        };
  const onFixed = (defect: Defect, result: RecheckResult) => {
    if (result.review === null) {
      onLeft({
        iterationId: iteration.id,
        title: document.title,
        tone: "green",
        heading: "Fixed",
        summary: joinDetails([
          `The checks no longer find ${defectNameOf(defect)}`,
          "nothing is left to rule on",
          result.progress === "Ready" ? "it is Ready" : null,
        ]),
        next,
      });
      return;
    }

    setLastFix({ defect, result });
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

  // Only an administrator overrules a restriction; anyone else may reach one (messaging.md §3).
  // Message… needs no permission of its own, only an enabled Message instance (§4).
  const headingActions: ViewAction[] = [];
  const canMessageAdmins =
    row.review === "Forbidden" &&
    !can(session, "restriction.overrule", scope) &&
    messageChannels.length > 0;
  if (canMessageAdmins) {
    headingActions.push({
      id: "message",
      label: "Message admins…",
      onSelect: () => setIsMessaging(true),
    });
  }

  if (next !== undefined) {
    headingActions.push({ id: "documents", label: `${next.label} →`, href: next.href });
  }

  headingActions.push(...more.actions);

  const defectCardOf = (defect: Defect) => (
    <DefectCard
      key={defect.key}
      defect={defect}
      iteration={iteration}
      fix={fixFor(defect)}
      onFixed={onFixed}
    />
  );

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
        {row.review === "Needed" && (
          <DetailCard title={`Outstanding — ${outstandingDefects(iteration).length}`}>
            {lastFix !== null && <FixNote defect={lastFix.defect} result={lastFix.result} />}
            {outstandingDefects(iteration).map(defectCardOf)}
            <VerdictControls row={row} scope={scope} session={session} />
            <FinePrint>
              Fix it and the checks run again: a defect that is gone needs no verdict. Accepting
              says it is tolerable — a later re-check finding the same or fewer asks nobody again.
            </FinePrint>
          </DetailCard>
        )}
        {row.review === "Denied" && (
          <DetailCard title="Fix it">
            {lastFix !== null && <FixNote defect={lastFix.defect} result={lastFix.result} />}
            {deniedDefectsOf(iteration).map(defectCardOf)}
          </DetailCard>
        )}
        {row.review === "Forbidden" && <ForbiddenCard session={session} />}
        <AcceptedCard
          row={row}
          nameOf={nameOf}
          action={<RevokeButton row={row} scope={scope} session={session} />}
        />
        <AttemptCard row={row} />
        <CatalogCard document={document} nameOf={nameOf} />
        <HistoryCard
          record={{ document, iterations: [iteration], requests: [] }}
          log={log}
          nameOf={nameOf}
          isPublic={false}
        />
      </div>

      {more.dialogs}
      <MessageDialog
        isOpen={isMessaging}
        onClose={() => setIsMessaging(false)}
        subject={{ kind: "restriction", id: iteration.id }}
        label={document.title}
        recipientLabel="who may overrule it"
      />
    </article>
  );
}

// What the checks found after a fix that left something to rule on.
function FixNote({ defect, result }: { defect: Defect; result: RecheckResult }) {
  if (result.clearedKeys.includes(defect.key)) {
    return (
      <StatusNote tone="green" className="mb-3" title="Saved, and the checks ran again">
        They no longer find {defectNameOf(defect)}; it needs no verdict and leaves the set you
        accept.
      </StatusNote>
    );
  }

  return (
    <StatusNote tone="amber" className="mb-3" title="Saved, and the checks ran again">
      They still find {defectNameOf(defect)}.
    </StatusNote>
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
        once the defect is gone — fix it below and the checks clear it.
      </StatusNote>
    );
  }

  if (row.review === "Needed" && isFoundAfterScan(iteration)) {
    return (
      <StatusNote tone="purple" className="mb-4" title={`${iteration.progress} · review needed`}>
        Found after the scan exists, so progress does not move back. Accepting records it as
        tolerable; denying marks it {iteration.progress} · denied in review. A fix goes to the
        catalog record, not here.
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
function AcceptedCard({ row, nameOf, action }: RowProps & { action: ReactNode }) {
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
    <DetailCard title={`Already accepted — ${accepted.length}`} action={action}>
      {accepted.map((defect) => {
        const acceptance = acceptanceOf(defect);
        return (
          <DetailRow
            key={defect.key}
            aside={
              <Muted>
                {acceptance === undefined ? (
                  "accepted"
                ) : (
                  <>
                    {nameOf(acceptance.actorId)}
                    <span className="block">{formatDay(acceptance.at)}</span>
                  </>
                )}
              </Muted>
            }
          >
            <b className="font-semibold">{defectNameOf(defect)}</b>{" "}
            <span className="font-mono text-xs text-muted-foreground">{defect.subject}</span>
            {defect.internalText !== null && (
              <div className="text-muted-foreground">{defect.internalText}</div>
            )}
            {acceptance?.note && <div className="text-muted-foreground">“{acceptance.note}”</div>}
          </DetailRow>
        );
      })}
      {row.review === "Needed" && (
        <FinePrint>
          Not asked again: the re-check found {accepted.length === 1 ? "it" : "them"} unchanged.
          Only what is new is outstanding.
        </FinePrint>
      )}
    </DetailCard>
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
