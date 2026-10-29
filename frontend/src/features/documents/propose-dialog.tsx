// Propose: one dialog holding one list of items (view-map.md §1, propose;
// docs/demos/shared/page-documents.js § propose). Items come in by any of the ways in, mixed
// freely: typed, found by a catalog search or a record link, pasted, from a file, scanned or
// read from a photo, each way there only while its plugin is enabled (ACT-ways-in). Each is
// checked as it lands, so every row already says what submitting will do: propose it, ask for
// it too, wait for a volume, or skip it. Then the details (why, a project, and for a curator the
// category, priority and approving at once), and a report of what was done. Anybody without
// `request.decide` adds at most the deployment's limit at once; what does not fit is reported,
// never dropped silently.
// TODO(rrandiak): labels move to i18n.

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
import {
  checkProposalItems,
  getProposalSettings,
  getRateLimitStatus,
  readRecordLink,
  submitProposal,
} from "@/api/proposals";
import { CategorySelect, Field, PrioritySelect } from "@/components/classification-fields";
import { StepIndicator } from "@/components/dialogs/step-indicator";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { allowedReturn, type EntryAsk, entryReasonLimit } from "@/features/documents/entry-link";
import { IdentifierRulesContext, useIdentifierRules } from "@/features/documents/identifier-rules";
import { BarcodeWay, CatalogSearchWay, PhotoWay } from "@/features/documents/propose-ways";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { requestsQueryKey } from "@/features/requests/use-requests-query";
import { referenceQueryKey, useProjectsQuery } from "@/hooks/use-reference-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { cn } from "@/lib/utils";

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
  value: string;
  unit: string | null;
  reason: string | null;
  source: string;
  check: ProposalCheck | null;
  isCheckFailed: boolean;
}

type Outcome = "new" | "inVera" | "open" | "skip";

function outcomeOf(item: DraftItem): Outcome {
  if (item.type === null || item.isCheckFailed) {
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
        {/* Remounted on every open, so a closed proposal starts afresh. */}
        {isOpen && (
          <ProposeFlow
            session={session}
            viewTitle={viewTitle}
            ask={ask}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProposeFlowProps {
  session: Session;
  viewTitle: string;
  onClose: () => void;
  ask?: EntryAsk;
}

function ProposeFlow({ session, viewTitle, onClose, ask }: ProposeFlowProps) {
  const [step, setStep] = useState<Step>("Items");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<ProposalReport | null>(null);
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
      setReport(submitted);
      setStep("Submitted");
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: watchlistsQueryKey });
      // What waits for a decision now includes these.
      void queryClient.invalidateQueries({ queryKey: [...requestsQueryKey, "list"] });
      void queryClient.invalidateQueries({ queryKey: [...referenceQueryKey, "batches"] });
      void queryClient.invalidateQueries({ queryKey: ["proposals", "rate-limit"] });
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
        overLimit > 0 &&
          `${overLimit} not added: at most ${limit} at once. Submit these, then propose the rest.`,
        duplicates > 0 && `${duplicates} already on the list, added once.`,
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
      setNotice("This link names no item to propose. Add one below.");
      return;
    }
    if (ask.record !== null) {
      const catalog = settings.linkCatalogs[0];
      if (catalog === undefined) {
        setNotice("This link's record cannot be read here. Add an item below.");
        return;
      }
      void readRecordLink({ catalogInstanceId: catalog.id, link: ask.record })
        .then(({ catalogId }) => {
          addFromAsk(
            [{ type: "catalogId", value: catalogId, unit: ask.unit, reason: null }],
            `record link · ${catalog.name}`,
          );
        })
        .catch(() => setNotice(`${catalog.name} could not read this record. Add an item below.`));
      return;
    }
    const parsedType = identifierTypeSchema.safeParse(ask.identifier?.type);
    if (ask.identifier === null) {
      setNotice("This link's identifier type cannot be read. Add an item below.");
      return;
    }
    if (!parsedType.success) {
      addFromAsk(
        [{ type: null, value: ask.identifier.value, unit: ask.unit, reason: null }],
        "Type it",
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
      "Type it",
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
        value: catalogId,
        unit: picked.unit,
        reason: picked.reason,
      })),
      `${picked.source} · ${identifierLabelOf(rules, picked.type)} ${picked.value}`,
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

  return (
    <IdentifierRulesContext value={rules}>
      <DialogHeader className="gap-3">
        <DialogTitle>{proposeActOf(session)}</DialogTitle>
        <DialogDescription className="sr-only">
          {proposeActOf(session)} documents for digitization, one or several at once.
        </DialogDescription>
        <StepIndicator steps={steps} currentIndex={steps.indexOf(step)} />
      </DialogHeader>

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
          onCancel={onClose}
          onContinue={() => setStep("Details")}
        />
      )}
      {step === "Details" && (
        <DetailsStep
          items={items}
          session={session}
          isSubmitting={submit.isPending}
          isFailed={submit.isError}
          rateLimit={rateLimit}
          initialReason={ask?.reason ?? ""}
          onBack={() => setStep("Items")}
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
          onDone={onClose}
          ask={ask}
          entrySources={settings?.entrySources ?? []}
        />
      )}
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
  onCancel: () => void;
  onContinue: () => void;
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
  onCancel,
  onContinue,
}: ItemsStepProps) {
  const tally = { new: 0, inVera: 0, open: 0, skip: 0 } satisfies Record<Outcome, number>;
  for (const item of items) {
    tally[outcomeOf(item)] += 1;
  }

  const hasSubmittable = tally.new + tally.inVera > 0;
  const continueRefusal =
    tally.open > 0
      ? "Choose the volume, or remove the item"
      : hasSubmittable
        ? null
        : "Nothing to submit yet";

  const dailyRemaining = rateLimit?.perDay ?? null;
  const [way, setWay] = useState<Way>("typed");
  const canDetectTypes = settings?.canDetectTypes ?? false;
  const searchCatalogs = settings?.searchCatalogs ?? [];
  const linkCatalogs = settings?.linkCatalogs ?? [];
  const hasCatalogWay = searchCatalogs.length + linkCatalogs.length > 0;
  // PERM-absent-not-disabled: a way whose plugin is not enabled is not offered.
  const ways: { way: Way; label: string }[] = [
    { way: "typed", label: "Type it" },
    ...(hasCatalogWay
      ? [
          {
            way: "catalog" as const,
            label: searchCatalogs.length > 0 ? "Catalog search" : "Record link",
          },
        ]
      : []),
    { way: "pasted", label: "Paste list" },
    { way: "file", label: "File upload" },
    { way: "barcode", label: "Barcode scan" },
    ...(settings?.canReadPhotos === true
      ? [{ way: "photo" as const, label: "Photo capture" }]
      : []),
  ];

  return (
    <>
      <div className="-mx-6 min-h-0 overflow-y-auto px-6">
        <Tabs value={way} onValueChange={(picked) => setWay(picked as Way)}>
          <TabsList className="h-auto flex-wrap">
            {ways.map((each) => (
              <TabsTrigger key={each.way} value={each.way}>
                {each.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="typed" className="pt-2">
            <TypedWay onAdd={(line) => onAdd([line], "typed")} />
          </TabsContent>
          {hasCatalogWay && (
            <TabsContent value="catalog" className="pt-2">
              <CatalogSearchWay
                searchCatalogs={searchCatalogs}
                linkCatalogs={linkCatalogs}
                onAdd={onAdd}
              />
            </TabsContent>
          )}
          <TabsContent value="pasted" className="pt-2">
            <PastedWay
              key={String(canDetectTypes)}
              canDetectTypes={canDetectTypes}
              onAdd={(lines) => onAdd(lines, "pasted")}
            />
          </TabsContent>
          <TabsContent value="file" className="pt-2">
            <FileWay onAdd={onAdd} />
          </TabsContent>
          <TabsContent value="barcode" className="pt-2">
            <BarcodeWay canScanWithCamera={settings?.canScanWithCamera === true} onAdd={onAdd} />
          </TabsContent>
          {settings?.canReadPhotos === true && (
            <TabsContent value="photo" className="pt-2">
              <PhotoWay
                onAdd={onAdd}
                onSearchInstead={hasCatalogWay ? () => setWay("catalog") : undefined}
              />
            </TabsContent>
          )}
        </Tabs>

        {notice !== null && (
          <StatusNote tone="amber" title="Not everything was added" className="mt-3">
            {notice}
          </StatusNote>
        )}

        {dailyRemaining === 0 && (
          <StatusNote tone="red" title="Daily proposal limit reached" className="mt-3">
            No more proposals today.
          </StatusNote>
        )}

        {dailyRemaining !== null && dailyRemaining > 0 && dailyRemaining <= 10 && (
          <StatusNote tone="amber" title="Approaching daily limit" className="mt-3">
            {dailyRemaining} left today.
          </StatusNote>
        )}

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-xs">
          <span className="font-semibold">
            {items.length === 0
              ? "No items yet"
              : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            {Number.isFinite(limit) && (
              <span className="font-normal text-muted-foreground"> · at most {limit} at once</span>
            )}
          </span>
          {items.length > 0 && (
            <span className="text-muted-foreground">
              {tally.new} new · {tally.inVera} already in VERA
              {tally.open > 0 && ` · ${tally.open} to resolve`}
              {tally.skip > 0 && ` · ${tally.skip} will be skipped`}
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

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="sm:mr-auto">
          Cancel
        </Button>
        <Button
          onClick={onContinue}
          disabled={continueRefusal !== null}
          title={continueRefusal ?? undefined}
        >
          Continue
        </Button>
      </DialogFooter>
    </>
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
      className="flex flex-wrap items-center gap-2"
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
        value={type}
        onChange={(picked) => {
          if (picked !== null) {
            setType(picked);
          }
        }}
      />
      <Input
        aria-label="Identifier"
        placeholder="value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-44 flex-1 font-mono"
      />
      <Input
        aria-label="Volume or issue"
        placeholder="volume or issue — optional"
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        className="h-8 w-48 flex-1"
      />
      <Button type="submit" size="sm" variant="outline" disabled={trimmed === ""}>
        Add
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
        aria-label="Items, one per line"
        rows={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"MZK01-001622010;1889;why\ncnb001388120"}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          One per line: identifier ; volume or issue ; why
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
          Add these
        </Button>
      </div>
    </div>
  );
}

function FileWay({ onAdd }: { onAdd: (lines: ProposalLine[], source: string) => void }) {
  const rules = useIdentifierRules();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUnreadable, setIsUnreadable] = useState(false);

  return (
    <div className="grid place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
      <FileUp className="size-6 text-muted-foreground" />
      <b className="text-sm font-semibold">A CSV or TXT file</b>
      <span className="text-xs text-muted-foreground">
        columns: identifier ; volume or issue ; why
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file === undefined) {
            return;
          }

          const text = await file.text().catch(() => null);
          setIsUnreadable(text === null);
          if (text !== null) {
            onAdd(parseProposalLines(text, null, rules), `file · ${file.name}`);
          }
        }}
      />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        Choose file…
      </Button>
      {isUnreadable && <p className="text-xs text-destructive">The file could not be read.</p>}
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
      <SelectTrigger size="sm" aria-label="Identifier type" className={cn("w-36", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {canDetect && <SelectItem value={autoDetect}>Detect the type</SelectItem>}
        {rules.map(({ type }) => (
          <SelectItem key={type} value={type}>
            {identifierLabelOf(rules, type)}
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
          {item.type === null ? "?" : identifierLabelOf(rules, item.type)} · {item.value}
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
        aria-label={`Remove ${item.value}`}
        onClick={onRemove}
        className="col-start-3 row-start-1 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:col-start-4"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

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
    return (
      <>
        <ToneBadge tone="red">Not a known identifier</ToneBadge>
        <Muted>pick its type</Muted>
        <TypeFix item={item} onChange={onChange} />
      </>
    );
  }

  if (item.isCheckFailed) {
    return (
      <>
        <ToneBadge tone="red">Could not be checked</ToneBadge>
        <Muted>remove it and add it again</Muted>
      </>
    );
  }

  const { check } = item;
  if (check === null) {
    return <Muted>Checking…</Muted>;
  }

  switch (check.kind) {
    case "new":
      return (
        <>
          <ToneBadge tone="green">New</ToneBadge>
          {check.isAskedBefore && <Muted>asked before, nothing moving</Muted>}
        </>
      );
    case "inVera":
      return (
        <>
          <ToneBadge tone="blue">In VERA</ToneBadge>
          <StatusBadge status={check.status} className="px-1.5 py-0 text-caption" />
          <Muted>· ask for this too</Muted>
        </>
      );
    case "mine":
      return (
        <>
          <ToneBadge tone="slate">Already yours</ToneBadge>
          <Muted>you ask for it already; skipped</Muted>
        </>
      );
    case "whichUnit":
      return (
        <>
          <ToneBadge tone="amber">Which volume?</ToneBadge>
          <Select onValueChange={(unit) => onChange({ unit })}>
            <SelectTrigger size="sm" aria-label="Volume or issue" className="h-7 w-32">
              <SelectValue placeholder="choose…" />
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
          <ToneBadge tone="red">Not in the catalog</ToneBadge>
          <Muted>will be skipped</Muted>
        </>
      );
  }
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
        <ToneBadge tone="amber">Which records?</ToneBadge>
        <Muted>{records.length} in the catalog</Muted>
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
        Add {picked.length === 0 ? "the picked" : picked.length}
      </Button>
    </span>
  );
}

// A value that is no identifier of the type it was read as gets the type that fits it.
function TypeFix({
  item,
  onChange,
}: {
  item: DraftItem;
  onChange: (patch: Partial<DraftItem>) => void;
}) {
  const rules = useIdentifierRules();
  const fitting = rules
    .map(({ type }) => type)
    .filter((type) => isIdentifierOf(rules, type, item.value));
  if (fitting.length === 0) {
    return null;
  }

  return (
    <Select
      onValueChange={(picked) => {
        const type = identifierTypeSchema.parse(picked);
        onChange({ type, value: normalisedOf(rules, type, item.value) });
      }}
    >
      <SelectTrigger size="sm" aria-label="Identifier type" className="h-7 w-32">
        <SelectValue placeholder="type…" />
      </SelectTrigger>
      <SelectContent>
        {fitting.map((type) => (
          <SelectItem key={type} value={type}>
            {identifierLabelOf(rules, type)}
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
  isSubmitting: boolean;
  isFailed: boolean;
  rateLimit: RateLimitStatus | undefined;
  initialReason: string;
  onBack: () => void;
  onSubmit: (details: Details) => void;
}

function DetailsStep({
  items,
  session,
  isSubmitting,
  isFailed,
  rateLimit,
  initialReason,
  onBack,
  onSubmit,
}: DetailsStepProps) {
  const fieldId = useId();
  const canDecide = hasPermission(session, "request.decide");
  const isStaff = hasPermission(session, "iteration.read");
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
  const submitRefusal = isApproving && categoryId === null ? "Choose a category" : null;

  return (
    <>
      <div className="-mx-6 grid min-h-0 content-start gap-4 overflow-y-auto px-6">
        {isStaff && isBatch && (
          <Field id={`${fieldId}-batch`} label="Batch name" hint="optional">
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
          label="Why"
          hint={`optional${items.length > 1 ? "; an item's own reason wins" : ""}`}
        >
          <Textarea
            id={`${fieldId}-reason`}
            rows={3}
            value={reason}
            maxLength={entryReasonLimit}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Research, exhibition, a reader's request…"
          />
        </Field>

        {proposable.length > 0 && (
          <Field
            id={`${fieldId}-project`}
            label="Project"
            hint="optional; the ones you are a member of"
          >
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={`${fieldId}-project`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noProject}>No project</SelectItem>
                {proposable.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} · {project.state.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Into a proposed project, it is approved with the project. Into an approved one, it is
              decided on its own.
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
                <b className="font-semibold">Approve now</b> — the {newCount} new skip review.{" "}
                <span className="text-muted-foreground">
                  Any with an existing copy waits in Requests like any other.
                </span>
              </Label>
            </div>
            {isApprovedNow && (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Field id={`${fieldId}-category`} label="Category" hint={`for the ${newCount} new`}>
                  <CategorySelect
                    id={`${fieldId}-category`}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                </Field>
                <Field id={`${fieldId}-priority`} label="Priority">
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
          {newCount} to propose · {joinCount} to join{skipCount > 0 && ` · ${skipCount} skipped`}
        </p>

        {rateLimit?.perDay !== null && rateLimit?.perDay !== undefined && (
          <p className="text-xs text-muted-foreground">
            Daily proposal limit · {rateLimit.perDay} left today
          </p>
        )}

        {isFailed && (
          <p className="text-xs text-destructive">
            The proposal could not be submitted. Try again.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack} className="sm:mr-auto">
          Back
        </Button>
        <Button
          disabled={isSubmitting || submitRefusal !== null}
          title={submitRefusal ?? undefined}
          onClick={() =>
            onSubmit({
              reason: reason.trim() || null,
              projectId: projectId === noProject ? null : projectId,
              batchName: isStaff && isBatch ? batchName.trim() || null : null,
              approval: isApproving && categoryId !== null ? { categoryId, priority } : null,
            })
          }
        >
          Submit
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------- report

interface ReportStepProps {
  report: ProposalReport;
  // Skipped before submitting: no known identifier, not in the catalog, already the caller's.
  skipped: DraftItem[];
  viewTitle: string;
  onDone: () => void;
  ask?: EntryAsk;
  entrySources: ProposalSettings["entrySources"];
}

function ReportStep({ report, skipped, viewTitle, onDone, ask, entrySources }: ReportStepProps) {
  const source = entrySources.find((entry) => entry.id === ask?.sourceId);
  const returnTo = allowedReturn(ask?.returnTo ?? null, source?.allowedOrigins ?? []);
  const skippedValues = [
    ...skipped.map((item) => [item.value, item.unit]),
    ...report.skipped.map((item) => [item.value, item.unit]),
  ].map((columns) => columns.filter((column) => column !== null).join(";"));
  const held = report.proposed - report.approved;

  return (
    <>
      <div className="-mx-6 grid min-h-0 content-start gap-3 overflow-y-auto px-6">
        <div className="flex items-start gap-2 border-l-[3px] border-tone-green-foreground bg-tone-green/50 px-3.5 py-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-tone-green-foreground" />
          <p>
            {report.batch === null || !isShownAsBatch(report.batch) ? (
              <b className="font-semibold">Submitted.</b>
            ) : (
              <>
                <b className="font-semibold">Submitted as {report.batch.id}</b>{" "}
                <span className="text-muted-foreground">{report.batch.name}</span>
              </>
            )}
          </p>
        </div>

        <ul className="text-sm">
          {report.approved > 0 && (
            <ReportLine count={report.approved}>approved — being added</ReportLine>
          )}
          {held > 0 && <ReportLine count={held}>proposed — waiting for review</ReportLine>}
          {report.joined > 0 && (
            <ReportLine count={report.joined}>
              joined work already in VERA — you follow it
            </ReportLine>
          )}
          {skippedValues.length > 0 && (
            <ReportLine count={skippedValues.length} isMuted>
              skipped
              <Button
                size="sm"
                variant="outline"
                className="ml-2 h-7"
                onClick={() => downloadText("skipped.txt", skippedValues.join("\n"))}
              >
                Download skipped
              </Button>
            </ReportLine>
          )}
        </ul>
        <p className="text-xs text-muted-foreground">You find them in {viewTitle}.</p>
      </div>

      <DialogFooter>
        {source !== undefined && returnTo !== null && (
          <Button variant="outline" asChild>
            <a href={returnTo}>Back to {source.name}</a>
          </Button>
        )}
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
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
