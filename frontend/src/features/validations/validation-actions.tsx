// What a curator does in the Validations pane (page-validation.js decideCard, acceptedCard,
// moreMenu and forbiddenPane). The verdicts: Accept takes the defects picked, all of them to
// begin with, with an optional note; Deny… picks which are substantial and the text every asker
// reads follows the pick; Revoke takes the acceptances back. Recheck sits beside them: the
// curator repairs the record in the catalog, and the checks read it again (decided 2026-10-06). More ▾ holds Reclassify and
// Cancel…, each with its reason. A forbidden item has no verdict here: a rule forbade it, and
// only an administrator overrules it, so the curator may message them. There are no bulk
// verdicts. Each act is offered only where the caller's grant reaches the item's category.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { CancellationRequest, RecheckResult, ReclassificationResult } from "@/api/iterations";
import { cancelIteration, recheckIteration } from "@/api/iterations";
import type { Denial } from "@/api/validations";
import { acceptDefects, denyDefects, revokeAcceptance } from "@/api/validations";
import type { ViewAction } from "@/components/actions/action-bar";
import { Field } from "@/components/classification-fields";
import { DetailCard, FinePrint } from "@/components/detail-card";
import type { ReasonTexts } from "@/components/dialogs/reason-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { ReclassifyDialog } from "@/components/iteration-dialogs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Defect, Session } from "@/domain/entities";
import { isCancellable, isReclassifiable } from "@/domain/iterations";
import type { ScopedRecord } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { outstandingDefects } from "@/domain/status";
import type { ValidationRow } from "@/domain/validations";
import { acceptedDefectsOf, defectNameOf, isFoundAfterScan } from "@/domain/validations";
import { validationInvalidations } from "@/features/validations/use-validations-query";
import { useActionMutation } from "@/hooks/use-action-mutation";

const verdictRefusals = {
  403: "You may no longer give this verdict.",
  404: "It no longer waits here.",
  409: "The defects have changed meanwhile; look again.",
} as const;

function askersHint(askerCount: number): string {
  return askerCount <= 1 ? "the asker reads this" : `all ${askerCount} askers read this`;
}

// ---------------------------------------------------------------- accept and deny

interface VerdictControlsProps {
  row: ValidationRow;
  scope: ScopedRecord;
  session: Session;
}

export function VerdictControls({
  row,
  scope,
  session,
  recheck,
}: VerdictControlsProps & { recheck: ReactNode }) {
  const id = useId();
  const { iteration } = row;
  const outstanding = outstandingDefects(iteration);
  const [note, setNote] = useState("");
  const [isDenying, setIsDenying] = useState(false);
  const allKeys = outstanding.map((defect) => defect.key);
  // Which to accept, and which to deny: each its own pick, all of them to begin with.
  const [acceptKeys, setAcceptKeys] = useState<readonly string[]>(allKeys);
  const [pickedKeys, setPickedKeys] = useState<readonly string[]>(allKeys);
  const accept = useActionMutation({
    call: (keys: readonly string[]) =>
      acceptDefects(iteration.id, { defectKeys: [...keys], note: note.trim() || null }),
    invalidates: validationInvalidations,
    refusalTexts: verdictRefusals,
  });
  const deny = useActionMutation({
    call: (denial: Denial) => denyDefects(iteration.id, denial),
    invalidates: validationInvalidations,
    refusalTexts: verdictRefusals,
  });
  const [failure, setFailure] = useState<string | null>(null);

  const mayAccept = can(session, "validation.approve", scope);
  const mayDeny = can(session, "validation.deny", scope);
  if ((!mayAccept && !mayDeny) || outstanding.length === 0) {
    return null;
  }

  const picked = outstanding.filter((defect) => pickedKeys.includes(defect.key));
  const toAccept = outstanding.filter((defect) => acceptKeys.includes(defect.key));
  const runAccept = async () => {
    const result = await accept.run(toAccept.map((defect) => defect.key));
    setFailure(result.isDone ? null : result.refusal.message);
  };
  const acceptLabel =
    outstanding.length === 1
      ? "Accept it"
      : toAccept.length === outstanding.length
        ? `Accept all ${outstanding.length}`
        : `Accept ${toAccept.length}`;
  const runDeny = ({ publicText, internalNote }: ReasonTexts) =>
    deny.run({
      defectKeys: picked.map((defect) => defect.key),
      publicText,
      internalText: internalNote || null,
    });

  return (
    <div className="mt-3 grid gap-3 border-t pt-3">
      {mayAccept && outstanding.length > 1 && (
        <DefectPick
          legend="Which to accept"
          defects={outstanding}
          pickedKeys={acceptKeys}
          onChange={setAcceptKeys}
        />
      )}
      {mayAccept && (
        <Field id={`${id}-note`} label="Note" hint="optional; kept with the verdict">
          <Textarea
            id={`${id}-note`}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this is tolerable"
          />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {mayAccept && (
          <Button
            size="sm"
            disabled={accept.isPending || toAccept.length === 0}
            onClick={() => void runAccept()}
          >
            {acceptLabel}
          </Button>
        )}
        {mayDeny && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => setIsDenying(true)}
          >
            Deny…
          </Button>
        )}
        {recheck}
        {failure !== null && <span className="text-xs text-destructive">{failure}</span>}
      </div>

      <ReasonDialog
        isOpen={isDenying}
        onClose={() => setIsDenying(false)}
        title={`Deny — ${row.document.title}`}
        description={
          isFoundAfterScan(iteration)
            ? `Rule the defects substantial. It stays ${iteration.progress} and reads denied in review.`
            : "Rule the defects substantial. It is held until they are repaired in the catalog; the denial lapses once they are gone."
        }
        fields={
          outstanding.length > 1 && (
            <DefectPick
              legend="Which are substantial"
              defects={outstanding}
              pickedKeys={pickedKeys}
              onChange={setPickedKeys}
            />
          )
        }
        publicText={{
          label: "What they are told",
          hint: askersHint(row.askerIds.length),
          isRequired: true,
          placeholder: "About the record, never a motive",
          suggestion: picked.map((defect) => defect.publicText).join(" "),
        }}
        internalNote={{ label: "Internal note", hint: "optional; staff only", isRequired: false }}
        confirmLabel={picked.length > 1 ? `Deny ${picked.length}` : "Deny"}
        isDestructive
        onConfirm={(texts) =>
          picked.length === 0
            ? Promise.resolve({
                isDone: false,
                refusal: { status: null, message: "Pick at least one defect." },
              })
            : runDeny(texts)
        }
      />
    </div>
  );
}

// A pick among the outstanding defects; all of them to begin with.
function DefectPick({
  legend,
  defects,
  pickedKeys,
  onChange,
}: {
  legend: string;
  defects: readonly Defect[];
  pickedKeys: readonly string[];
  onChange: (keys: readonly string[]) => void;
}) {
  const id = useId();

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {defects.map((defect) => {
        const isPicked = pickedKeys.includes(defect.key);
        return (
          <div key={defect.key} className="flex items-center gap-2">
            <Checkbox
              id={`${id}-${defect.key}`}
              checked={isPicked}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...pickedKeys, defect.key]
                    : pickedKeys.filter((key) => key !== defect.key),
                )
              }
            />
            <Label htmlFor={`${id}-${defect.key}`} className="font-normal">
              {defectNameOf(defect)}{" "}
              <span className="font-mono text-xs text-muted-foreground">{defect.subject}</span>
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}

// ---------------------------------------------------------------- revoke

export function RevokeButton({ row, scope, session }: VerdictControlsProps) {
  const revoke = useActionMutation({
    call: (keys: readonly string[]) =>
      revokeAcceptance(row.iteration.id, { defectKeys: [...keys] }),
    invalidates: validationInvalidations,
    refusalTexts: { ...verdictRefusals, 409: "Nothing is accepted now." },
  });
  const [failure, setFailure] = useState<string | null>(null);
  if (!can(session, "validation.revoke", scope)) {
    return null;
  }

  const run = async () => {
    const keys = acceptedDefectsOf(row.iteration).map((defect) => defect.key);
    const result = await revoke.run(keys);
    setFailure(result.isDone ? null : result.refusal.message);
  };

  return (
    <span className="flex items-center gap-2">
      {failure !== null && <span className="text-xs text-destructive">{failure}</span>}
      <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => void run()}>
        Revoke
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------- recheck

interface RecheckButtonProps extends VerdictControlsProps {
  onRechecked: (result: RecheckResult) => void;
}

// Reads the record from the catalog again and runs the checks: what was repaired there is gone.
export function RecheckButton({ row, scope, session, onRechecked }: RecheckButtonProps) {
  const recheck = useActionMutation({
    call: () => recheckIteration(row.iteration.id),
    invalidates: validationInvalidations,
    refusalTexts: { 404: "It no longer waits here." },
  });
  const [failure, setFailure] = useState<string | null>(null);
  if (!can(session, "validation.approve", scope)) {
    return null;
  }

  const run = async () => {
    const result = await recheck.run(undefined);
    setFailure(result.isDone ? null : result.refusal.message);
    if (result.isDone) {
      onRechecked(result.value);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" disabled={recheck.isPending} onClick={() => void run()}>
        {recheck.isPending ? "Rechecking…" : "Recheck"}
      </Button>
      {failure !== null && <span className="text-xs text-destructive">{failure}</span>}
    </>
  );
}

// ---------------------------------------------------------------- More ▾

type OpenDialog = "reclassify" | "cancel" | null;

interface MoreActionsOptions extends VerdictControlsProps {
  onHandedOver: (result: ReclassificationResult) => void;
  onCancelled: (askerCount: number) => void;
}

// The record acts that are not verdicts on defects, for More ▾, and their dialogs. A forbidden
// item has none here: only an administrator acts on it.
export function useMoreActions({
  row,
  scope,
  session,
  onHandedOver,
  onCancelled,
}: MoreActionsOptions) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const cancel = useActionMutation({
    call: (cancellation: CancellationRequest) => cancelIteration(row.iteration.id, cancellation),
    invalidates: validationInvalidations,
    refusalTexts: { 409: "It is already held, or it has been scanned meanwhile." },
  });
  const { iteration } = row;
  const isForbidden = row.review === "Forbidden";

  const actions: ViewAction[] = [];
  if (!isForbidden && can(session, "iteration.classify", scope) && isReclassifiable(iteration)) {
    actions.push({
      id: "reclassify",
      label: "Reclassify — category, priority…",
      isInMenu: true,
      onSelect: () => setOpenDialog("reclassify"),
    });
  }

  if (!isForbidden && can(session, "iteration.cancel", scope) && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: "Cancel…",
      isInMenu: true,
      isDestructive: true,
      onSelect: () => setOpenDialog("cancel"),
    });
  }

  const dialogs = (
    <>
      <ReclassifyDialog
        key={`reclassify-${iteration.id}-${iteration.categoryId}-${iteration.priority}`}
        isOpen={openDialog === "reclassify"}
        onClose={() => setOpenDialog(null)}
        title={row.document.title}
        iteration={iteration}
        invalidates={validationInvalidations}
        session={session}
        onDone={(result) => {
          if (result.isHandedOver) {
            onHandedOver(result);
          }
        }}
      />
      <ReasonDialog
        isOpen={openDialog === "cancel"}
        onClose={() => setOpenDialog(null)}
        title={`Cancel — ${row.document.title}`}
        description="Hold it at the gate. It stays in Documents, where Resume lets it through again."
        publicText={{
          label: "Reason",
          hint: askersHint(row.askerIds.length),
          isRequired: true,
          placeholder: "e.g. Postponed — will be scheduled next quarter.",
        }}
        internalNote={{ label: "Internal note", hint: "optional; staff only", isRequired: false }}
        confirmLabel="Cancel it"
        isDestructive
        onConfirm={async ({ publicText, internalNote }) => {
          const result = await cancel.run({ publicText, internalText: internalNote || null });
          if (result.isDone) {
            onCancelled(result.value.askerCount);
          }

          return result;
        }}
      />
    </>
  );

  return { actions, dialogs };
}

// ---------------------------------------------------------------- forbidden

export function ForbiddenCard({ session }: { session: Session }) {
  const mayOverrule = can(session, "restriction.overrule");

  return (
    <DetailCard title="What you can do">
      <p className="text-muted-foreground">
        {mayOverrule
          ? "Overrule it from Documents. The rule is re-checked on every change to the record, and a re-check that no longer finds it clears it."
          : "Nothing here acts on a restriction. If the rule is wrong for this item, message an administrator: they can overrule it. A re-check that no longer finds it clears it by itself."}
      </p>
      <FinePrint>A restriction is set by a rule, never by a person.</FinePrint>
    </DetailCard>
  );
}
