// What a curator does in the Validations pane (page-validation.js decideCard, acceptedCard,
// moreMenu and forbiddenPane). The verdicts: Accept takes the defects picked, all of them to
// begin with, with an optional note; Deny… picks which are substantial and the text every asker
// reads follows the pick; Revoke takes the acceptances back. Recheck sits beside them: the
// curator repairs the record in the catalog, and the checks read it again (decided 2026-10-06). More ▾ holds Reclassify and
// Cancel…, each with its reason. A forbidden item has no verdict here: a rule forbade it, and
// only an administrator overrules it, so the curator may message them. There are no bulk
// verdicts. Each act is offered only where the caller's grant reaches the item's category.

import type {
  CancellationRequest,
  RecheckResult,
  ReclassificationResult,
} from "@vera/contract/iterations";
import type { Denial } from "@vera/contract/validations";
import type { Defect, Session } from "@vera/domain/entities";
import { isCancellable, isReclassifiable } from "@vera/domain/iterations";
import type { ScopedRecord } from "@vera/domain/permissions";
import { can } from "@vera/domain/permissions";
import { outstandingDefects } from "@vera/domain/status";
import type { ValidationRow } from "@vera/domain/validations";
import { acceptedDefectsOf, defectNameOf, isFoundAfterScan } from "@vera/domain/validations";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cancelIteration, recheckIteration } from "@/api/iterations";
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
import { validationInvalidations } from "@/features/validations/use-validations-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { i18n } from "@/i18n";

const verdictRefusals = () => ({
  403: i18n.t("validations:action.noVerdict"),
  404: i18n.t("validations:action.notWaiting"),
  409: i18n.t("validations:action.defectsChanged"),
});

function askersHint(askerCount: number): string {
  return i18n.t(
    askerCount <= 1 ? "validations:action.askerReads_one" : "validations:action.askerReads_other",
    { count: askerCount },
  );
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
  const { t } = useTranslation("validations");
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
    refusalTexts: verdictRefusals(),
  });
  const deny = useActionMutation({
    call: (denial: Denial) => denyDefects(iteration.id, denial),
    invalidates: validationInvalidations,
    refusalTexts: verdictRefusals(),
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
      ? t("action.acceptIt")
      : toAccept.length === outstanding.length
        ? t("action.acceptAll", { count: outstanding.length })
        : t("action.acceptCount", { count: toAccept.length });
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
          legend={t("action.whichToAccept")}
          defects={outstanding}
          pickedKeys={acceptKeys}
          onChange={setAcceptKeys}
        />
      )}
      {mayAccept && (
        <Field id={`${id}-note`} label={t("action.note")} hint={t("action.optionalKept")}>
          <Textarea
            id={`${id}-note`}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("action.tolerablePlaceholder")}
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
            {t("action.denyEllipsis")}
          </Button>
        )}
        {recheck}
        {failure !== null && <span className="text-xs text-destructive">{failure}</span>}
      </div>

      <ReasonDialog
        isOpen={isDenying}
        onClose={() => setIsDenying(false)}
        title={t("action.denyTitle", { title: row.document.title })}
        description={
          isFoundAfterScan(iteration)
            ? t("action.denyAfterScanDescription", {
                progress: t(`progress.${iteration.progress}`),
              })
            : t("action.denyDescription")
        }
        fields={
          outstanding.length > 1 && (
            <DefectPick
              legend={t("action.whichSubstantial")}
              defects={outstanding}
              pickedKeys={pickedKeys}
              onChange={setPickedKeys}
            />
          )
        }
        publicText={{
          label: t("action.whatTold"),
          hint: askersHint(row.askerIds.length),
          isRequired: true,
          placeholder: t("action.aboutRecordPlaceholder"),
          suggestion: picked.map((defect) => defect.publicText).join(" "),
        }}
        internalNote={{
          label: t("action.internalNote"),
          hint: t("action.staffOnly"),
          isRequired: false,
        }}
        confirmLabel={
          picked.length > 1 ? t("action.denyCount", { count: picked.length }) : t("action.deny")
        }
        isDestructive
        onConfirm={(texts) =>
          picked.length === 0
            ? Promise.resolve({
                isDone: false,
                refusal: { status: null, code: null, message: t("action.pickDefect") },
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
  const references = useReferenceLabels(["pluginInstances"]);
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
              {defectNameOf(defect, references.pluginInstances)}{" "}
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
  const { t } = useTranslation("validations");
  const revoke = useActionMutation({
    call: (keys: readonly string[]) =>
      revokeAcceptance(row.iteration.id, { defectKeys: [...keys] }),
    invalidates: validationInvalidations,
    refusalTexts: { ...verdictRefusals(), 409: t("action.nothingAccepted") },
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
        {t("action.revoke")}
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
  const { t } = useTranslation("validations");
  const recheck = useActionMutation({
    call: () => recheckIteration(row.iteration.id),
    invalidates: validationInvalidations,
    refusalTexts: { 404: t("action.notWaiting") },
  });
  const [failure, setFailure] = useState<string | null>(null);
  if (!can(session, "iteration.recheck", scope)) {
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
        {recheck.isPending ? t("action.rechecking") : t("action.recheck")}
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
  const { t } = useTranslation("validations");
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const cancel = useActionMutation({
    call: (cancellation: CancellationRequest) => cancelIteration(row.iteration.id, cancellation),
    invalidates: validationInvalidations,
    refusalTexts: { 409: t("action.cancelConflict") },
  });
  const { iteration } = row;
  const isForbidden = row.review === "Forbidden";

  const actions: ViewAction[] = [];
  if (!isForbidden && can(session, "iteration.classify", scope) && isReclassifiable(iteration)) {
    actions.push({
      id: "reclassify",
      label: t("action.reclassify"),
      isInMenu: true,
      onSelect: () => setOpenDialog("reclassify"),
    });
  }

  if (!isForbidden && can(session, "iteration.cancel", scope) && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: t("action.cancelEllipsis"),
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
        title={t("action.cancelTitle", { title: row.document.title })}
        description={t("action.cancelDescription")}
        publicText={{
          label: t("action.reason"),
          hint: askersHint(row.askerIds.length),
          isRequired: true,
          placeholder: t("action.cancelPlaceholder"),
        }}
        internalNote={{
          label: t("action.internalNote"),
          hint: t("action.staffOnly"),
          isRequired: false,
        }}
        confirmLabel={t("action.cancelIt")}
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

// A restriction takes no verdict; the overrule is an act on the record in Documents (ACT-overrule).
export function ForbiddenCard({ session }: { session: Session }) {
  const { t } = useTranslation("validations");
  const mayOverrule = can(session, "restriction.overrule");

  return (
    <DetailCard title={t("action.whatYouCanDo")}>
      <p className="text-muted-foreground">
        {mayOverrule ? t("action.overruleAdvice") : t("action.noOverruleAdvice")}
      </p>
      <FinePrint>{t("action.restrictionRule")}</FinePrint>
    </DetailCard>
  );
}
