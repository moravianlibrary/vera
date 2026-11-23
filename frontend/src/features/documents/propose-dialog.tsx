// Propose: one dialog holding one list of items (view-map.md §1, propose;
// docs/demos/shared/page-documents.js § propose). Items come in by any of the ways in, mixed
// freely: typed, found by a catalog search or a record link, pasted, from a file, scanned or
// read from a photo, each way there only while its plugin is enabled (ACT-ways-in). Each is
// checked as it lands, so every row already says what submitting will do: propose it, ask for
// it too, wait for a volume, or skip it. Then the details (why, a project, and for a curator the
// category, priority and approving at once), and a report of what was done. Anybody without
// `request.decide` adds at most the deployment's limit at once; what does not fit is reported,
// never dropped silently.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProposalCheck,
  ProposalDraft,
  ProposalReport,
  ProposalSettings,
  RateLimitStatus,
} from "@vera/contract/proposals";
import { isShownAsBatch } from "@vera/domain/documents";
import type { Priority, Session } from "@vera/domain/entities";
import type { IdentifierType, IdentifierTypeRule } from "@vera/domain/identifiers";
import {
  identifierLabelOf,
  identifierTypeSchema,
  isIdentifierOf,
  normalisedOf,
} from "@vera/domain/identifiers";
import { hasPermission, proposeActOf } from "@vera/domain/permissions";
import { isProjectMember } from "@vera/domain/projects";
import type { ProposalLine } from "@vera/domain/proposals";
import { defaultBatchNameOf, parseProposalLines, readIdentifier } from "@vera/domain/proposals";
import { Check, FileUp, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/http";
import {
  checkProposalItems,
  getProposalSettings,
  getRateLimitStatus,
  readRecordLink,
  submitProposal,
} from "@/api/proposals";
import type { ChoicePanel } from "@/components/choice-tabs";
import { ChoiceTabs } from "@/components/choice-tabs";
import { CategorySelect, Field, PrioritySelect } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { StepIndicator } from "@/components/dialogs/step-indicator";
import { useFilePicker } from "@/components/fields/file-picker";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { allowedReturn, type EntryAsk, entryReasonLimit } from "@/features/documents/entry-link";
import { IdentifierRulesContext, useIdentifierRules } from "@/features/documents/identifier-rules";
import { BarcodeWay, CatalogSearchWay, PhotoWay } from "@/features/documents/propose-ways";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { requestsQueryKey } from "@/features/requests/use-requests-query";
import { referenceQueryKey, useProjectsQuery } from "@/hooks/use-reference-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";
import { interfaceLanguage } from "@/i18n/language";
import { recordAct } from "@/lib/telemetry/telemetry";
import { cn } from "@/lib/utils";

const stepLabels = [
  "proposal.stepItems",
  "proposal.stepDetails",
  "proposal.stepSubmitted",
] as const;
const steps = ["Items", "Details", "Submitted"] as const;
type Step = (typeof steps)[number];

const autoDetect = "auto";

const noRules: readonly IdentifierTypeRule[] = [];

type Way = "typed" | "catalog" | "pasted" | "file" | "barcode" | "photo";
const noProject = "none";

// An item on the list. Its check is null while it is being made, and a failed one is retried
// by removing and adding the item again.
interface DraftItem {
  key: string;
  type: IdentifierType | null;
  candidateTypes: IdentifierType[];
  value: string;
  unit: string | null;
  reason: string | null;
  source: string;
  check: ProposalCheck | null;
  isCheckFailed: boolean;
}

type Outcome = "new" | "inVera" | "open" | "skip";

function outcomeOf(item: DraftItem): Outcome {
  if (item.type === null) {
    return item.candidateTypes.length >= 2 ? "open" : "skip";
  }
  if (item.isCheckFailed) {
    return "skip";
  }

  if (item.check === null || item.check.kind === "whichUnit" || item.check.kind === "whichRecord") {
    return "open";
  }

  if (item.check.kind === "new" || item.check.kind === "inVera") {
    return item.check.kind;
  }

  return "skip";
}

interface ProposeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  session: Session;
  // What the caller's Documents view is called, where the proposed items show from now on.
  viewTitle: string;
  ask?: EntryAsk;
}

export function ProposeDialog({
  isOpen,
  onOpenChange,
  session,
  viewTitle,
  ask,
}: ProposeDialogProps) {
  // Remounted on every open, so a closed proposal starts afresh.
  return isOpen ? (
    <ProposeFlow
      session={session}
      viewTitle={viewTitle}
      ask={ask}
      onClose={() => onOpenChange(false)}
    />
  ) : null;
}

interface ProposeFlowProps {
  session: Session;
  viewTitle: string;
  onClose: () => void;
  ask?: EntryAsk;
}

function ProposeFlow({ session, viewTitle, onClose, ask }: ProposeFlowProps) {
  useTranslation("documents");
  const [step, setStep] = useState<Step>("Items");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<ProposalReport | null>(null);
  const [submitRefusal, setSubmitRefusal] = useState<string | null>(null);
  const detailsSubmit = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["proposals", "settings"],
    queryFn: getProposalSettings,
    staleTime: 60_000,
  });
  const { data: rateLimit } = useQuery<RateLimitStatus>({
    queryKey: ["proposals", "rate-limit"],
    queryFn: getRateLimitStatus,
    staleTime: 60_000,
    refetchInterval: 60_000, // Refresh when the library's calendar day changes.
  });
  const limit = settings === undefined ? 0 : (settings.maxAtOnce ?? Number.POSITIVE_INFINITY);
  const rules = settings?.identifierTypes ?? noRules;
  const askLanded = useRef(false);

  const submit = useMutation({
    mutationFn: submitProposal,
    onSuccess: (submitted) => {
      recordAct("ACT-propose", "done");
      setReport(submitted);
      setStep("Submitted");
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: watchlistsQueryKey });
      // What waits for a decision now includes these.
      void queryClient.invalidateQueries({ queryKey: [...requestsQueryKey, "list"] });
      void queryClient.invalidateQueries({ queryKey: [...referenceQueryKey, "batches"] });
      void queryClient.invalidateQueries({ queryKey: ["proposals", "rate-limit"] });
    },
    onError: (error) => {
      recordAct("ACT-propose", "refused", error instanceof ApiError ? error.status : undefined);
    },
  });

  const check = async (toCheck: DraftItem[]) => {
    const checkable = toCheck.flatMap(({ key, type, value, unit }) =>
      type === null ? [] : [{ key, item: { type, value, unit } }],
    );
    if (checkable.length === 0) {
      return;
    }

    const answers = await checkProposalItems(checkable.map(({ item }) => item)).catch(() => null);
    const byKey = new Map(checkable.map((item, index) => [item.key, answers?.[index] ?? null]));
    setItems((current) =>
      current.map((item) =>
        byKey.has(item.key)
          ? { ...item, check: byKey.get(item.key) ?? null, isCheckFailed: answers === null }
          : item,
      ),
    );
  };

  // What fits beside the kept items and is not among them yet, saying what did not.
  const admit = (kept: DraftItem[], lines: ProposalLine[], source: string) => {
    const isSame = (first: { value: string; unit: string | null }, second: typeof first) =>
      first.value.toLowerCase() === second.value.toLowerCase() && first.unit === second.unit;
    let duplicates = 0;
    let overLimit = 0;
    const added: DraftItem[] = [];
    for (const line of lines) {
      if ([...kept, ...added].some((item) => isSame(item, line))) {
        duplicates += 1;
        continue;
      }

      if (kept.length + added.length >= limit) {
        overLimit += 1;
        continue;
      }

      added.push({
        ...line,
        key: crypto.randomUUID(),
        source,
        check: null,
        isCheckFailed: false,
      });
    }

    setNotice(
      [
        overLimit > 0 && i18n.t("proposal.overLimit", { ns: "documents", count: overLimit, limit }),
        duplicates > 0 && i18n.t("proposal.duplicates", { ns: "documents", count: duplicates }),
      ]
        .filter(Boolean)
        .join(" ") || null,
    );
    void check(added);
    return added;
  };

  const add = (lines: ProposalLine[], source: string) => {
    const added = admit(items, lines, source);
    setItems((current) => [...current, ...added]);
  };
  const addFromAsk = useEffectEvent(add);

  useEffect(() => {
    if (ask === undefined || askLanded.current || settings === undefined) return;
    askLanded.current = true;
    if (ask.record === null && ask.identifier === null) {
      setNotice(i18n.t("proposal.linkNoItem", { ns: "documents" }));
      return;
    }
    if (ask.record !== null) {
      const catalog = settings.linkCatalogs[0];
      if (catalog === undefined) {
        setNotice(i18n.t("proposal.linkRecordUnreadable", { ns: "documents" }));
        return;
      }
      void readRecordLink({ catalogInstanceId: catalog.id, link: ask.record })
        .then(({ catalogId }) => {
          addFromAsk(
            [
              {
                type: "catalogId",
                candidateTypes: [],
                value: catalogId,
                unit: ask.unit,
                reason: null,
              },
            ],
            i18n.t("proposeWays.recordLinkSource", { ns: "documents", name: catalog.name }),
          );
        })
        .catch(() =>
          setNotice(
            i18n.t("proposal.catalogCannotRead", { ns: "documents", catalog: catalog.name }),
          ),
        );
      return;
    }
    const parsedType = identifierTypeSchema.safeParse(ask.identifier?.type);
    if (ask.identifier === null) {
      setNotice(i18n.t("proposal.linkTypeUnreadable", { ns: "documents" }));
      return;
    }
    if (!parsedType.success) {
      addFromAsk(
        [
          {
            type: null,
            candidateTypes: [],
            value: ask.identifier.value,
            unit: ask.unit,
            reason: null,
          },
        ],
        i18n.t("proposal.typeIt", { ns: "documents" }),
      );
      return;
    }
    addFromAsk(
      [
        {
          ...readIdentifier(rules, ask.identifier.value, parsedType.data),
          unit: ask.unit,
          reason: null,
        },
      ],
      i18n.t("proposal.typeIt", { ns: "documents" }),
    );
  }, [ask, settings, rules]);

  // DOC-records: each record picked of an identifier's several is its own item, in its place.
  const pickRecords = (key: string, catalogIds: string[]) => {
    const picked = items.find((item) => item.key === key);
    if (picked?.type == null) {
      return;
    }

    const added = admit(
      items.filter((item) => item.key !== key),
      catalogIds.map((catalogId) => ({
        type: "catalogId" as const,
        candidateTypes: [],
        value: catalogId,
        unit: picked.unit,
        reason: picked.reason,
      })),
      i18n.t("proposal.pickedSource", {
        ns: "documents",
        source: picked.source,
        type: identifierLabelOf(rules, picked.type, interfaceLanguage()),
        value: picked.value,
      }),
    );
    setItems((current) => current.flatMap((item) => (item.key === key ? added : [item])));
  };

  const change = (key: string, patch: Partial<DraftItem>) => {
    const changed = items.find((item) => item.key === key);
    if (changed === undefined) {
      return;
    }

    const next = { ...changed, ...patch, check: null, isCheckFailed: false };
    setItems((current) => current.map((item) => (item.key === key ? next : item)));
    void check([next]);
  };

  const remove = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
    setNotice(null);
  };

  const tally = { new: 0, inVera: 0, open: 0, skip: 0 } satisfies Record<Outcome, number>;
  for (const item of items) tally[outcomeOf(item)] += 1;
  const hasSubmittable = tally.new + tally.inVera > 0;
  const continueRefusal =
    tally.open > 0
      ? i18n.t("proposal.resolveUnit", { ns: "documents" })
      : hasSubmittable
        ? null
        : i18n.t("proposal.nothingToSubmit", { ns: "documents" });
  const description = i18n.t("proposal.description", {
    ns: "documents",
    action: i18n.t(`proposal.act.${proposeActOf(session)}`, { ns: "documents" }),
  });
  const entrySource = (settings?.entrySources ?? []).find((entry) => entry.id === ask?.sourceId);
  const returnTo = ask?.sourceId
    ? ask.returnTo
    : allowedReturn(ask?.returnTo ?? null, entrySource?.allowedOrigins ?? []);
  const backToSource =
    entrySource !== undefined && returnTo !== null
      ? {
          label: i18n.t("proposal.backToSource", { ns: "documents", source: entrySource.name }),
          href: returnTo,
        }
      : undefined;
  const primary =
    step === "Items"
      ? {
          label: i18n.t("proposal.continue", { ns: "documents" }),
          isDisabled: continueRefusal !== null,
          disabledReason: continueRefusal ?? undefined,
          onSelect: () => setStep("Details"),
        }
      : step === "Details"
        ? {
            label: i18n.t("proposal.submit", { ns: "documents" }),
            isPending: submit.isPending,
            isDisabled: submitRefusal !== null,
            disabledReason: submitRefusal ?? undefined,
            onSelect: () => detailsSubmit.current?.(),
          }
        : { label: i18n.t("proposal.done", { ns: "documents" }), onSelect: onClose };

  return (
    <IdentifierRulesContext value={rules}>
      <DialogShell
        isOpen
        onClose={onClose}
        title={i18n.t(`proposal.act.${proposeActOf(session)}`, { ns: "documents" })}
        description={description}
        width="wide"
        isDirty={items.length > 0 && step !== "Submitted"}
        head={
          <StepIndicator
            steps={stepLabels.map((key) => i18n.t(key, { ns: "documents" }))}
            currentIndex={steps.indexOf(step)}
          />
        }
        onBack={step === "Details" ? () => setStep("Items") : undefined}
        cancelLabel={step === "Submitted" ? null : i18n.t("proposal.cancel", { ns: "documents" })}
        primary={primary}
        secondary={step === "Submitted" && report !== null ? backToSource : undefined}
      >
        {step === "Items" && (
          <ItemsStep
            items={items}
            limit={limit}
            settings={settings}
            rateLimit={rateLimit}
            notice={notice}
            onAdd={add}
            onChange={change}
            onPickRecords={pickRecords}
            onRemove={remove}
          />
        )}
        {step === "Details" && (
          <DetailsStep
            items={items}
            session={session}
            isFailed={submit.isError}
            failureMessage={
              submit.error instanceof ApiError &&
              submit.error.problem?.code === "proposal.daily_limit"
                ? i18n.t("refusals:proposal.daily_limit")
                : i18n.t("proposal.submitError", { ns: "documents" })
            }
            onRefusalChange={setSubmitRefusal}
            submitRef={detailsSubmit}
            rateLimit={rateLimit}
            initialReason={ask?.reason ?? ""}
            onSubmit={(details) => {
              const accepted = items.flatMap(({ type, value, check, reason, source }) =>
                type !== null && (check?.kind === "new" || check?.kind === "inVera")
                  ? [{ type, value, unit: check.unit, reason, source }]
                  : [],
              );
              submit.mutate({
                ...details,
                entrySourceId: ask?.sourceId ?? null,
                items: accepted.map(({ source: _source, ...item }) => item),
              });
            }}
          />
        )}
        {step === "Submitted" && report !== null && (
          <ReportStep
            report={report}
            skipped={items.filter((item) => outcomeOf(item) === "skip")}
            viewTitle={viewTitle}
          />
        )}
      </DialogShell>
    </IdentifierRulesContext>
  );
}

// ---------------------------------------------------------------- items

interface ItemsStepProps {
  items: DraftItem[];
  limit: number;
  // Which ways in the enabled plugins offer; none beyond the plain ones until it answers.
  settings: ProposalSettings | undefined;
  rateLimit: RateLimitStatus | undefined;
  notice: string | null;
  onAdd: (lines: ProposalLine[], source: string) => void;
  onChange: (key: string, patch: Partial<DraftItem>) => void;
  onPickRecords: (key: string, catalogIds: string[]) => void;
  onRemove: (key: string) => void;
}

function ItemsStep({
  items,
  limit,
  settings,
  rateLimit,
  notice,
  onAdd,
  onChange,
  onPickRecords,
  onRemove,
}: ItemsStepProps) {
  const tally = { new: 0, inVera: 0, open: 0, skip: 0 } satisfies Record<Outcome, number>;
  for (const item of items) {
    tally[outcomeOf(item)] += 1;
  }

  const dailyRemaining = rateLimit?.perDay ?? null;
  const [way, setWay] = useState<Way>("typed");
  const canDetectTypes = settings?.canDetectTypes ?? false;
  const searchCatalogs = settings?.searchCatalogs ?? [];
  const linkCatalogs = settings?.linkCatalogs ?? [];
  const hasCatalogWay = searchCatalogs.length + linkCatalogs.length > 0;
  // PERM-absent-not-disabled: a way whose plugin is not enabled is not offered.
  const panels: ChoicePanel<Way>[] = [
    {
      value: "typed",
      label: i18n.t("proposal.typeIt", { ns: "documents" }),
      content: (
        <TypedWay
          onAdd={(line) => onAdd([line], i18n.t("proposal.typedSource", { ns: "documents" }))}
        />
      ),
    },
    ...(hasCatalogWay
      ? [
          {
            value: "catalog" as const,
            label: i18n.t(
              searchCatalogs.length > 0 ? "proposal.catalogSearch" : "proposal.recordLink",
              { ns: "documents" },
            ),
            content: (
              <CatalogSearchWay
                searchCatalogs={searchCatalogs}
                linkCatalogs={linkCatalogs}
                onAdd={onAdd}
              />
            ),
          },
        ]
      : []),
    {
      value: "pasted",
      label: i18n.t("proposal.pasteList", { ns: "documents" }),
      content: (
        <PastedWay
          key={String(canDetectTypes)}
          canDetectTypes={canDetectTypes}
          onAdd={(lines) => onAdd(lines, i18n.t("proposal.pastedSource", { ns: "documents" }))}
        />
      ),
    },
    {
      value: "file",
      label: i18n.t("proposal.fileUpload", { ns: "documents" }),
      content: <FileWay onAdd={onAdd} />,
    },
    {
      value: "barcode",
      label: i18n.t("proposal.barcodeScan", { ns: "documents" }),
      content: (
        <BarcodeWay canScanWithCamera={settings?.canScanWithCamera === true} onAdd={onAdd} />
      ),
    },
    ...(settings !== undefined && settings.photoReaders.length > 0
      ? [
          {
            value: "photo" as const,
            label: i18n.t("proposal.photoCapture", { ns: "documents" }),
            content: (
              <PhotoWay
                readers={settings.photoReaders}
                onAdd={onAdd}
                onSearchInstead={hasCatalogWay ? () => setWay("catalog") : undefined}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <ChoiceTabs
        value={way}
        onChange={setWay}
        label={i18n.t("proposal.waysLabel", { ns: "documents" })}
        panels={panels}
      />

      {notice !== null && (
        <StatusNote
          tone="amber"
          title={i18n.t("proposal.notEverythingAdded", { ns: "documents" })}
          className="mt-3"
        >
          {notice}
        </StatusNote>
      )}

      {dailyRemaining === 0 && (
        <StatusNote
          tone="red"
          title={i18n.t("proposal.dailyLimit", { ns: "documents" })}
          className="mt-3"
        >
          {i18n.t("proposal.noMoreToday", { ns: "documents" })}
        </StatusNote>
      )}

      {dailyRemaining !== null && dailyRemaining > 0 && dailyRemaining <= 10 && (
        <StatusNote
          tone="amber"
          title={i18n.t("proposal.approachingLimit", { ns: "documents" })}
          className="mt-3"
        >
          {i18n.t("proposal.leftToday", { ns: "documents", count: dailyRemaining })}
        </StatusNote>
      )}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-xs">
        <span className="font-semibold">
          {items.length === 0
            ? i18n.t("proposal.noItems", { ns: "documents" })
            : i18n.t("proposal.itemCount", { ns: "documents", count: items.length })}
          {Number.isFinite(limit) && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {i18n.t("proposal.atMost", { ns: "documents", count: limit })}
            </span>
          )}
        </span>
        {items.length > 0 && (
          <span className="text-muted-foreground">
            {i18n.t("proposal.tallyNew", { ns: "documents", count: tally.new })} ·{" "}
            {i18n.t("proposal.tallyInVera", { ns: "documents", count: tally.inVera })}
            {tally.open > 0 &&
              ` · ${i18n.t("proposal.tallyResolve", { ns: "documents", count: tally.open })}`}
            {tally.skip > 0 &&
              ` · ${i18n.t("proposal.tallySkip", { ns: "documents", count: tally.skip })}`}
          </span>
        )}
      </div>

      <ol>
        {items.map((item, index) => (
          <ItemRow
            key={item.key}
            item={item}
            number={index + 1}
            onChange={(patch) => onChange(item.key, patch)}
            onPickRecords={(catalogIds) => onPickRecords(item.key, catalogIds)}
            onRemove={() => onRemove(item.key)}
          />
        ))}
      </ol>
    </div>
  );
}

function TypedWay({ onAdd }: { onAdd: (line: ProposalLine) => void }) {
  const rules = useIdentifierRules();
  const [type, setType] = useState<IdentifierType>("catalogId");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const trimmed = value.trim();

  return (
    <form
      className="grid grid-cols-1 items-center gap-2 sm:flex sm:flex-wrap"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed === "") {
          return;
        }

        onAdd({ ...readIdentifier(rules, trimmed, type), unit: unit.trim() || null, reason: null });
        setValue("");
        setUnit("");
      }}
    >
      <IdentifierTypeSelect
        className="w-full sm:w-52"
        value={type}
        onChange={(picked) => {
          if (picked !== null) {
            setType(picked);
          }
        }}
      />
      <Input
        aria-label={i18n.t("proposal.identifier", { ns: "documents" })}
        placeholder={i18n.t("proposal.value", { ns: "documents" })}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-full min-w-0 font-mono sm:w-44 sm:flex-1"
      />
      <Input
        aria-label={i18n.t("proposal.volumeIssue", { ns: "documents" })}
        placeholder={i18n.t("proposal.volumeIssueOptional", { ns: "documents" })}
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        className="h-8 w-full min-w-0 sm:w-48 sm:flex-1"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={trimmed === ""}
        className="w-full sm:w-auto"
      >
        {i18n.t("proposal.add", { ns: "documents" })}
      </Button>
    </form>
  );
}

function PastedWay({
  canDetectTypes,
  onAdd,
}: {
  canDetectTypes: boolean;
  onAdd: (lines: ProposalLine[]) => void;
}) {
  const rules = useIdentifierRules();
  const [text, setText] = useState("");
  const [type, setType] = useState<IdentifierType | null>(canDetectTypes ? null : "catalogId");

  return (
    <div className="grid gap-2">
      <Textarea
        aria-label={i18n.t("proposal.itemsOnePerLine", { ns: "documents" })}
        rows={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={i18n.t("proposal.pasteExample", { ns: "documents" })}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {i18n.t("proposal.pasteHelp", { ns: "documents" })}
        </span>
        <IdentifierTypeSelect
          value={type}
          onChange={setType}
          canDetect={canDetectTypes}
          className="ml-auto"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={text.trim() === ""}
          onClick={() => {
            onAdd(parseProposalLines(text, type, rules));
            setText("");
          }}
        >
          {i18n.t("proposal.addThese", { ns: "documents" })}
        </Button>
      </div>
    </div>
  );
}

function FileWay({ onAdd }: { onAdd: (lines: ProposalLine[], source: string) => void }) {
  const rules = useIdentifierRules();
  const [isUnreadable, setIsUnreadable] = useState(false);
  const picker = useFilePicker({
    accept: ".csv,.txt,text/csv,text/plain",
    onFile: async (file) => {
      const text = await file.text().catch(() => null);
      setIsUnreadable(text === null);
      if (text !== null)
        onAdd(
          parseProposalLines(text, null, rules),
          i18n.t("proposal.fileSource", { ns: "documents", name: file.name }),
        );
    },
  });

  return (
    <div className="grid place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
      <FileUp className="size-6 text-muted-foreground" />
      <b className="text-sm font-semibold">{i18n.t("proposal.csvOrTxt", { ns: "documents" })}</b>
      <span className="text-xs text-muted-foreground">
        {i18n.t("proposal.fileColumns", { ns: "documents" })}
      </span>
      {picker.input}
      <Button size="sm" variant="outline" onClick={picker.open}>
        {i18n.t("proposal.chooseFile", { ns: "documents" })}
      </Button>
      {isUnreadable && (
        <p className="text-xs text-destructive">
          {i18n.t("proposal.fileUnreadable", { ns: "documents" })}
        </p>
      )}
    </div>
  );
}

interface IdentifierTypeSelectProps {
  // Null detects each line's type.
  value: IdentifierType | null;
  onChange: (value: IdentifierType | null) => void;
  canDetect?: boolean;
  className?: string;
}

function IdentifierTypeSelect({
  value,
  onChange,
  canDetect = false,
  className,
}: IdentifierTypeSelectProps) {
  const rules = useIdentifierRules();
  return (
    <Select
      value={value ?? autoDetect}
      onValueChange={(picked) => {
        const parsed = identifierTypeSchema.safeParse(picked);
        if (parsed.success) {
          onChange(parsed.data);
        } else if (canDetect) {
          onChange(null);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={i18n.t("proposal.identifierType", { ns: "documents" })}
        className={cn("w-52", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {canDetect && (
          <SelectItem value={autoDetect}>
            {i18n.t("proposal.detectType", { ns: "documents" })}
          </SelectItem>
        )}
        {rules.map(({ type }) => (
          <SelectItem key={type} value={type}>
            {identifierLabelOf(rules, type, interfaceLanguage())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ItemRowProps {
  item: DraftItem;
  number: number;
  onChange: (patch: Partial<DraftItem>) => void;
  onPickRecords: (catalogIds: string[]) => void;
  onRemove: () => void;
}

function ItemRow({ item, number, onChange, onPickRecords, onRemove }: ItemRowProps) {
  const rules = useIdentifierRules();
  const outcome = outcomeOf(item);
  const title = item.check !== null && "title" in item.check ? item.check.title : null;

  return (
    <li
      className={cn(
        "grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b py-2 text-sm @container sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_auto]",
        outcome === "skip" && "text-muted-foreground",
      )}
    >
      <span className="pt-0.5 text-xs text-muted-foreground tabular-nums">{number}</span>
      <span className="min-w-0">
        <span className="font-mono text-xs break-words">
          {item.type === null ? "?" : identifierLabelOf(rules, item.type, interfaceLanguage())} ·{" "}
          {item.value}
          {item.unit !== null && ` · ${item.unit}`}
        </span>{" "}
        <span className="text-xs text-muted-foreground">{item.source}</span>
        {title !== null && <b className="block font-semibold">{title}</b>}
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-1.5 text-xs sm:col-start-3">
        <ItemOutcome item={item} onChange={onChange} onPickRecords={onPickRecords} />
      </span>
      <button
        type="button"
        aria-label={i18n.t("proposal.remove", { ns: "documents", value: item.value })}
        onClick={onRemove}
        className="col-start-3 row-start-1 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:col-start-4"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

// LC-REQ-preview: show each item's check preview beside its proposed outcome.
function ItemOutcome({
  item,
  onChange,
  onPickRecords,
}: {
  item: DraftItem;
  onChange: (patch: Partial<DraftItem>) => void;
  onPickRecords: (catalogIds: string[]) => void;
}) {
  if (item.type === null) {
    if (item.candidateTypes.length >= 2) {
      return (
        <>
          <ToneBadge tone="amber">{i18n.t("proposal.whichType", { ns: "documents" })}</ToneBadge>
          <TypeFix item={item} types={item.candidateTypes} onChange={onChange} />
        </>
      );
    }
    return (
      <>
        <ToneBadge tone="red">
          {i18n.t("proposal.unknownIdentifier", { ns: "documents" })}
        </ToneBadge>
        <Muted>{i18n.t("proposal.pickItsType", { ns: "documents" })}</Muted>
        <TypeFix item={item} onChange={onChange} />
      </>
    );
  }

  if (item.isCheckFailed) {
    return (
      <>
        <ToneBadge tone="red">{i18n.t("proposal.couldNotCheck", { ns: "documents" })}</ToneBadge>
        <Muted>{i18n.t("proposal.removeAndAdd", { ns: "documents" })}</Muted>
      </>
    );
  }

  const { check } = item;
  if (check === null) {
    return <Muted>{i18n.t("proposal.checking", { ns: "documents" })}</Muted>;
  }

  switch (check.kind) {
    case "new":
      return (
        <>
          <ToneBadge tone="green">{i18n.t("proposal.new", { ns: "documents" })}</ToneBadge>
          {check.isAskedBefore && (
            <Muted>{i18n.t("proposal.askedBefore", { ns: "documents" })}</Muted>
          )}
          <ProposalPreview preview={check.preview} />
        </>
      );
    case "inVera":
      return (
        <>
          <ToneBadge tone="blue">{i18n.t("proposal.inVera", { ns: "documents" })}</ToneBadge>
          <StatusBadge status={check.status} className="px-1.5 py-0 text-caption" />
          <Muted>· {i18n.t("proposal.askForThisToo", { ns: "documents" })}</Muted>
          <ProposalPreview preview={check.preview} />
        </>
      );
    case "mine":
      return (
        <>
          <ToneBadge tone="slate">{i18n.t("proposal.alreadyYours", { ns: "documents" })}</ToneBadge>
          <Muted>{i18n.t("proposal.alreadyAskedSkipped", { ns: "documents" })}</Muted>
        </>
      );
    case "whichUnit":
      return (
        <>
          <ToneBadge tone="amber">{i18n.t("proposal.whichVolume", { ns: "documents" })}</ToneBadge>
          <Select onValueChange={(unit) => onChange({ unit })}>
            <SelectTrigger
              size="sm"
              aria-label={i18n.t("proposal.volumeIssue", { ns: "documents" })}
              className="h-7 w-32"
            >
              <SelectValue placeholder={i18n.t("proposal.choose", { ns: "documents" })} />
            </SelectTrigger>
            <SelectContent>
              {check.units.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      );
    case "whichRecord":
      return <RecordPick records={check.records} onPick={onPickRecords} />;
    case "notInCatalog":
      return (
        <>
          <ToneBadge tone="red">{i18n.t("proposal.notInCatalog", { ns: "documents" })}</ToneBadge>
          <Muted>{i18n.t("proposal.willBeSkipped", { ns: "documents" })}</Muted>
        </>
      );
  }
}

// LC-REQ-preview: show the server's live copy and staff restriction preview below the item.
function ProposalPreview({
  preview,
}: {
  preview: Extract<ProposalCheck, { kind: "new" }>["preview"];
}) {
  return (
    <span className="flex flex-col gap-1 text-xs">
      {preview.copies === null ? (
        <Muted>{i18n.t("proposal.checkedAfterSubmit", { ns: "documents" })}</Muted>
      ) : (
        preview.copies.map((copy) => (
          <span key={`${copy.source}-${copy.link ?? copy.state}`}>
            {i18n.t("proposal.alreadyAvailable", { ns: "documents" })} ·{" "}
            {copy.link ? (
              <a className="underline" href={copy.link} target="_blank" rel="noreferrer">
                {copy.source}
              </a>
            ) : (
              copy.source
            )}
          </span>
        ))
      )}
      {preview.restrictions?.map(
        (finding) =>
          finding.forbidden && (
            <Muted key={`${finding.until ?? ""}-${finding.why}`}>
              {finding.until === null
                ? i18n.t("proposal.forbiddenPreviewOpenEnded", {
                    ns: "documents",
                    why: finding.why,
                  })
                : i18n.t("proposal.forbiddenPreview", {
                    ns: "documents",
                    until: finding.until,
                    why: finding.why,
                  })}
            </Muted>
          ),
      )}
    </span>
  );
}

// DOC-records: the records an identifier names, none picked; each picked becomes its own item.
function RecordPick({
  records,
  onPick,
}: {
  records: readonly { catalogId: string; title: string }[];
  onPick: (catalogIds: string[]) => void;
}) {
  const fieldId = useId();
  const [picked, setPicked] = useState<readonly string[]>([]);
  return (
    <span className="flex w-full flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <ToneBadge tone="amber">{i18n.t("proposal.whichRecords", { ns: "documents" })}</ToneBadge>
        <Muted>
          {i18n.t("proposal.recordsInCatalog", { ns: "documents", count: records.length })}
        </Muted>
      </span>
      {records.map(({ catalogId, title }) => (
        <span key={catalogId} className="flex items-center gap-2">
          <Checkbox
            id={`${fieldId}-${catalogId}`}
            checked={picked.includes(catalogId)}
            onCheckedChange={(isChecked) =>
              setPicked((current) =>
                isChecked === true
                  ? [...current, catalogId]
                  : current.filter((each) => each !== catalogId),
              )
            }
          />
          <Label htmlFor={`${fieldId}-${catalogId}`} className="text-xs font-normal">
            <span className="font-mono">{catalogId}</span> · {title}
          </Label>
        </span>
      ))}
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        disabled={picked.length === 0}
        onClick={() => onPick([...picked])}
      >
        {picked.length === 0
          ? i18n.t("proposal.addPickedNone", { ns: "documents" })
          : i18n.t("proposal.addPicked", { ns: "documents", count: picked.length })}
      </Button>
    </span>
  );
}

// A value that is no identifier of the type it was read as gets the type that fits it.
function TypeFix({
  item,
  types,
  onChange,
}: {
  item: DraftItem;
  types?: readonly IdentifierType[];
  onChange: (patch: Partial<DraftItem>) => void;
}) {
  const rules = useIdentifierRules();
  const fitting =
    types ??
    rules.map(({ type }) => type).filter((type) => isIdentifierOf(rules, type, item.value));
  if (fitting.length === 0) {
    return null;
  }

  return (
    <Select
      onValueChange={(picked) => {
        const type = identifierTypeSchema.parse(picked);
        onChange({ type, candidateTypes: [], value: normalisedOf(rules, type, item.value) });
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={i18n.t("proposal.identifierType", { ns: "documents" })}
        className="h-7 w-32"
      >
        <SelectValue placeholder={i18n.t("proposal.type", { ns: "documents" })} />
      </SelectTrigger>
      <SelectContent>
        {fitting.map((type) => (
          <SelectItem key={type} value={type}>
            {identifierLabelOf(rules, type, interfaceLanguage())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

// ---------------------------------------------------------------- details

type Details = Pick<ProposalDraft, "reason" | "projectId" | "batchName" | "approval">;

interface DetailsStepProps {
  items: DraftItem[];
  session: Session;
  isFailed: boolean;
  failureMessage: string;
  rateLimit: RateLimitStatus | undefined;
  initialReason: string;
  onRefusalChange: (refusal: string | null) => void;
  submitRef: { current: (() => void) | null };
  onSubmit: (details: Details) => void;
}

function DetailsStep({
  items,
  session,
  isFailed,
  failureMessage,
  rateLimit,
  initialReason,
  onRefusalChange,
  submitRef,
  onSubmit,
}: DetailsStepProps) {
  const fieldId = useId();
  const canDecide = hasPermission(session, "request.decide");
  const { data: projects = [] } = useProjectsQuery();
  const newCount = items.filter((item) => outcomeOf(item) === "new").length;
  const joinCount = items.filter((item) => outcomeOf(item) === "inVera").length;
  const skipCount = items.filter((item) => outcomeOf(item) === "skip").length;
  const isBatch = newCount + joinCount > 1;
  const proposable = projects.filter(
    (project) =>
      project.state !== "Rejected" && isProjectMember(project, session.user.id, session.groupIds),
  );

  // Empty unless the person names it; the server names it by when it came in (ENT-batch).
  const [batchName, setBatchName] = useState("");
  const [reason, setReason] = useState(initialReason.slice(0, entryReasonLimit));
  const [projectId, setProjectId] = useState<string>(noProject);
  const [isApprovedNow, setIsApprovedNow] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const isApproving = canDecide && newCount > 0 && isApprovedNow;
  const submitRefusal =
    rateLimit?.perDay === 0
      ? i18n.t("refusals:proposal.daily_limit")
      : isApproving && categoryId === null
        ? i18n.t("proposal.chooseCategory", { ns: "documents" })
        : null;
  useEffect(() => onRefusalChange(submitRefusal), [onRefusalChange, submitRefusal]);
  useEffect(() => {
    submitRef.current = () =>
      onSubmit({
        reason: reason.trim() || null,
        projectId: projectId === noProject ? null : projectId,
        batchName: isBatch ? batchName.trim() || null : null,
        approval: isApproving && categoryId !== null ? { categoryId, priority } : null,
      });
  });

  return (
    <div className="grid content-start gap-4">
      {isBatch && (
        <Field
          id={`${fieldId}-batch`}
          label={i18n.t("proposal.batchName", { ns: "documents" })}
          hint={i18n.t("proposal.optional", { ns: "documents" })}
        >
          <Input
            id={`${fieldId}-batch`}
            value={batchName}
            placeholder={defaultBatchNameOf(new Date())}
            onChange={(event) => setBatchName(event.target.value)}
          />
        </Field>
      )}

      <Field
        id={`${fieldId}-reason`}
        label={i18n.t("proposal.why", { ns: "documents" })}
        hint={i18n.t(items.length > 1 ? "proposal.optionalReasonBatch" : "proposal.optional", {
          ns: "documents",
        })}
      >
        <Textarea
          id={`${fieldId}-reason`}
          rows={3}
          value={reason}
          maxLength={entryReasonLimit}
          onChange={(event) => setReason(event.target.value)}
          placeholder={i18n.t("proposal.reasonPlaceholder", { ns: "documents" })}
        />
      </Field>

      {proposable.length > 0 && (
        <Field
          id={`${fieldId}-project`}
          label={i18n.t("proposal.project", { ns: "documents" })}
          hint={i18n.t("proposal.projectHint", { ns: "documents" })}
        >
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id={`${fieldId}-project`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noProject}>
                {i18n.t("proposal.noProject", { ns: "documents" })}
              </SelectItem>
              {proposable.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} ·{" "}
                  {i18n.t(`proposal.projectState.${project.state}`, { ns: "documents" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {i18n.t("proposal.projectDescription", { ns: "documents" })}
          </p>
        </Field>
      )}

      {canDecide && newCount > 0 && (
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id={`${fieldId}-approve`}
              checked={isApprovedNow}
              onCheckedChange={(isChecked) => setIsApprovedNow(isChecked === true)}
            />
            <Label
              htmlFor={`${fieldId}-approve`}
              className="block text-sm leading-snug font-normal"
            >
              <b className="font-semibold">{i18n.t("proposal.approveNow", { ns: "documents" })}</b>{" "}
              — {i18n.t("proposal.newSkipReview", { ns: "documents", count: newCount })}{" "}
              <span className="text-muted-foreground">
                {i18n.t("proposal.existingCopyWaits", { ns: "documents" })}
              </span>
            </Label>
          </div>
          {isApprovedNow && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Field
                id={`${fieldId}-category`}
                label={i18n.t("field.category", { ns: "documents" })}
                hint={i18n.t("proposal.categoryForNew", { ns: "documents", count: newCount })}
              >
                <CategorySelect
                  id={`${fieldId}-category`}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </Field>
              <Field
                id={`${fieldId}-priority`}
                label={i18n.t("field.priority", { ns: "documents" })}
              >
                <PrioritySelect
                  id={`${fieldId}-priority`}
                  value={priority}
                  onChange={setPriority}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {i18n.t("proposal.totals", {
          ns: "documents",
          proposed: newCount,
          joined: joinCount,
          skipped:
            skipCount > 0
              ? ` · ${i18n.t("proposal.skippedCount", { ns: "documents", count: skipCount })}`
              : "",
        })}
      </p>

      {rateLimit?.perDay !== null && rateLimit?.perDay !== undefined && (
        <p className="text-xs text-muted-foreground">
          {i18n.t("proposal.dailyLimitRemaining", { ns: "documents", count: rateLimit.perDay })}
        </p>
      )}

      {isFailed && <p className="text-xs text-destructive">{failureMessage}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- report

interface ReportStepProps {
  report: ProposalReport;
  // Skipped before submitting: no known identifier, not in the catalog, already the caller's.
  skipped: DraftItem[];
  viewTitle: string;
}

function ReportStep({ report, skipped, viewTitle }: ReportStepProps) {
  const skippedValues = [
    ...skipped.map((item) => [item.value, item.unit]),
    ...report.skipped.map((item) => [item.value, item.unit]),
  ].map((columns) => columns.filter((column) => column !== null).join(";"));
  const held = report.proposed - report.approved;

  return (
    <div className="grid content-start gap-3">
      <div className="flex items-start gap-2 border-l-[3px] border-tone-green-foreground bg-tone-green/50 px-3.5 py-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-tone-green-foreground" />
        <p>
          {report.batch === null || !isShownAsBatch(report.batch) ? (
            <b className="font-semibold">{i18n.t("proposal.submitted", { ns: "documents" })}</b>
          ) : (
            <>
              <b className="font-semibold">
                {i18n.t("proposal.submittedAs", { ns: "documents", id: report.batch.id })}
              </b>{" "}
              <span className="text-muted-foreground">{report.batch.name}</span>
            </>
          )}
        </p>
      </div>

      <ul className="text-sm">
        {report.approved > 0 && (
          <ReportLine count={report.approved}>
            {i18n.t("proposal.approvedBeingAdded", { ns: "documents", count: report.approved })}
          </ReportLine>
        )}
        {held > 0 && (
          <ReportLine count={held}>
            {i18n.t("proposal.proposedWaiting", { ns: "documents", count: held })}
          </ReportLine>
        )}
        {report.joined > 0 && (
          <ReportLine count={report.joined}>
            {i18n.t("proposal.joinedWork", { ns: "documents", count: report.joined })}
          </ReportLine>
        )}
        {skippedValues.length > 0 && (
          <ReportLine count={skippedValues.length} isMuted>
            {i18n.t("proposal.skipped", { ns: "documents" })}
            <Button
              size="sm"
              variant="outline"
              className="ml-2 h-7"
              onClick={() => downloadText("skipped.txt", skippedValues.join("\n"))}
            >
              {i18n.t("proposal.downloadSkipped", { ns: "documents" })}
            </Button>
          </ReportLine>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        {i18n.t("proposal.findThemIn", { ns: "documents", view: viewTitle })}
      </p>
    </div>
  );
}

function ReportLine({
  count,
  isMuted = false,
  children,
}: {
  count: number;
  isMuted?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b py-2 last:border-b-0",
        isMuted && "text-muted-foreground",
      )}
    >
      <span className="w-6 text-right font-semibold tabular-nums">{count}</span>
      <span>{children}</span>
    </li>
  );
}

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
