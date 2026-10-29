// The list editor, for a new list and for an existing one alike (view-map.md §2.4, flows.md
// L1, L2, L9): the list itself on top (name, when it starts and ends, pages against a target),
// what is on it on the left and what is ready to list on the right. Everything is a draft until
// Save; taking an item off returns it to the pool with no reason. The pool filters by category
// and search, and says what review still holds back. Saving goes back to the list in browse.
// Generate… in the left pane's head drafts a fill with a configured list generator (L3–L5): its
// picks join the left pane marked *generated* with their reason, and its report stays in the
// top strip. Without a generator there is no Generate. Started from an intention's card, a new
// list opens Generate at once, shaped by it, with the pages or a correcting run's allocation
// (intentions.md §4.4). The top says what the draft counts towards, worked out from what is on
// it and when it starts, its fill against one intention's mix, and warns when it will not count
// towards the intention it was generated with, or will stop counting towards one (L8, L10).
// TODO(rrandiak): labels move to i18n.

import type {
  GenerationDraft,
  ListDetail,
  ListDraft,
  ListItem,
  ListReading,
  ListShape,
} from "@vera/contract/lists";
import type { PropertyParams } from "@vera/contract/properties";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Category } from "@vera/domain/entities";
import { priorities } from "@vera/domain/entities";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createList, saveList } from "@/api/lists";
import { Muted } from "@/components/detail-card";
import type { PropertyFilterProps } from "@/components/filters/property-filters";
import { PropertyFilterControls } from "@/components/filters/property-filters";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { failureOf } from "@/components/query-state";
import { PriorityBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { TransferEditor } from "@/components/transfer-editor";
import { Input } from "@/components/ui/input";
import { GenerateDialog } from "@/features/lists/generate-dialog";
import { GenerationReport } from "@/features/lists/generation-report";
import { CountsTowardsLine, MixMeters } from "@/features/lists/list-intentions";
import type { GenerationStart } from "@/features/lists/lists-view";
import {
  listInvalidations,
  useListGeneratorsQuery,
  useListReadingQuery,
  useListShapesQuery,
  usePoolQuery,
} from "@/features/lists/use-lists-query";
import {
  filterablePropertiesOf,
  usePropertiesQuery,
} from "@/features/properties/use-properties-query";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { isSameSet, useDraft } from "@/hooks/use-draft";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

interface ListFields {
  name: string;
  // A new list starts now unless a day is given; an existing one keeps its day.
  startsNow: boolean;
  startsOn: string;
  endsOn: string;
  // As typed; digits only count.
  target: string;
}

function fieldsOf(detail: ListDetail | null): ListFields {
  if (detail === null) {
    return { name: "", startsNow: true, startsOn: "", endsOn: "", target: "" };
  }

  const { list } = detail.row;
  return {
    name: list.name,
    startsNow: false,
    startsOn: list.startsOn,
    endsOn: list.endsOn,
    target: list.targetPages === null ? "" : String(list.targetPages),
  };
}

const isSameFields = (first: ListFields, second: ListFields) =>
  (Object.keys(first) as (keyof ListFields)[]).every((key) => first[key] === second[key]);

function targetOf(typed: string): number | null {
  const digits = Number.parseInt(typed.replace(/\D/g, ""), 10);
  return Number.isNaN(digits) || digits <= 0 ? null : digits;
}

const pagesOf = (items: readonly ListItem[]) =>
  items.reduce((sum, item) => sum + (item.pages ?? 0), 0);

// Highest priority first, then the oldest ask, as the server orders the pool.
function byPriorityThenAge(first: ListItem, second: ListItem): number {
  const rankOf = (item: ListItem) => priorities.indexOf(item.iteration.priority);
  return rankOf(second) - rankOf(first) || first.askedAt.localeCompare(second.askedAt);
}

interface ListEditorProps {
  // Null for a new list.
  detail: ListDetail | null;
  // A new list an intention's card started.
  start?: GenerationStart | null;
  canOpenIntentions: boolean;
}

export function ListEditor({ detail, start = null, canOpenIntentions }: ListEditorProps) {
  const navigate = useNavigate();
  const listId = detail?.row.list.id ?? null;
  const fields = useDraft(fieldsOf(detail), isSameFields);
  const members = useDraft<ReadonlySet<string>>(
    new Set(detail?.members.map((item) => item.iteration.id) ?? []),
    isSameSet,
  );
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [propertyParams, setPropertyParams] = useState<PropertyParams | undefined>(undefined);
  const { data: propertyIndex } = usePropertiesQuery();
  const poolQuery = {
    search: useDeferredValue(search).trim() || undefined,
    categoryId: categoryId || undefined,
    properties: propertyParams,
  };
  const pool = usePoolQuery(poolQuery);
  const { data: categories = [] } = useCategoriesQuery();
  const { data: generators = [] } = useListGeneratorsQuery();
  const { data: shapes = [] } = useListShapesQuery();
  const [isGenerating, setIsGenerating] = useState(start !== null);
  // The intention the fill is read against, and Generate's default: what it was generated with,
  // or what started it; none is Overall.
  const [mixBy, setMixBy] = useState<string | null>(
    start?.intentionId ?? detail?.row.generatedWith?.id ?? null,
  );
  // A correcting run's allocation, until it is generated with or dropped for the plain mix.
  const [allocation, setAllocation] = useState(
    start?.allocation === null || start === null
      ? null
      : {
          pages:
            start.pages ?? Object.values(start.allocation).reduce((sum, pages) => sum + pages, 0),
          byCategory: start.allocation,
        },
  );
  // The last draft taken from a generator: its report, and the provenance saving records.
  const [generation, setGeneration] = useState<GenerationDraft | null>(null);
  const [isReportShown, setIsReportShown] = useState(false);
  // Why each generated pick was made, by item ID.
  const [reasons, setReasons] = useState<ReadonlyMap<string, string>>(new Map());
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // Where to go once the drafts read clean, so leaving does not ask about what was just saved.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const isOtherwiseDirty = fields.isDirty || generation !== null;
  const isDirty = isOtherwiseDirty || members.isDirty;

  useEffect(() => {
    if (leaveTo !== null && !isDirty) {
      navigate(leaveTo);
    }
  }, [leaveTo, isDirty, navigate]);

  // Every item met, by its ID: one added from the pool stays known when the pool's filter
  // changes and it is no longer among the pool's rows.
  const knownRef = useRef(new Map<string, ListItem>());
  for (const item of [...(detail?.members ?? []), ...(pool.items ?? [])]) {
    knownRef.current.set(item.iteration.id, item);
  }

  const known = knownRef.current;
  const originalIds = members.original;
  // What was there first, then what a generator added.
  const onList = [...members.current]
    .flatMap((id) => known.get(id) ?? [])
    .toSorted(
      (first, second) =>
        Number(reasons.has(first.iteration.id)) - Number(reasons.has(second.iteration.id)) ||
        byPriorityThenAge(first, second),
    );
  const takenOff = [...originalIds]
    .filter((id) => !members.current.has(id))
    .flatMap((id) => known.get(id) ?? []);
  const ready = (pool.items ?? []).filter((item) => !members.current.has(item.iteration.id));
  // The server counts the pool as saved; the draft has taken some of it and given some back.
  const drafted = (pool.items ?? []).filter((item) => members.current.has(item.iteration.id));
  const poolCount =
    pool.summary === undefined
      ? null
      : {
          total: pool.summary.total - drafted.length + takenOff.length,
          pages: pool.summary.pages - pagesOf(drafted) + pagesOf(takenOff),
        };
  const pages = pagesOf(onList);
  const target = targetOf(fields.current.target);
  const lateCopies = onList.filter((item) => item.lateCopy !== null).length;
  const backHref = listId === null ? "/lists" : `/lists?id=${encodeURIComponent(listId)}`;

  const save = useActionMutation<ListDraft, ListDetail>({
    call: (draft) => (listId === null ? createList(draft) : saveList(listId, draft)),
    act: listId === null ? "ACT-list-create" : undefined,
    invalidates: listInvalidations,
    refusalTexts: {
      "list.member_unavailable": "Something you put on it is no longer ready to list.",
      "list.done": "This list was marked Done meanwhile; it no longer changes.",
    },
  });

  const { name, startsNow, startsOn, endsOn } = fields.current;
  // The provenance in force: a generation since the editor opened, else what was saved.
  const provenance = generation?.provenance ?? detail?.row.list.generated ?? null;
  const reading = useListReadingQuery({
    listId,
    startsOn: startsNow || startsOn === "" ? null : startsOn,
    memberIds: [...members.current].toSorted(),
    intentionId: mixBy,
    targetPages: target,
    allocation:
      provenance !== null && provenance.intentionId === mixBy ? provenance.allocation : null,
  }).data;
  const generatedWith =
    provenance === null
      ? null
      : (shapes.find((shape) => shape.id === provenance.intentionId) ??
        (detail?.row.generatedWith?.id === provenance.intentionId
          ? detail.row.generatedWith
          : null));
  const canSave =
    name.trim() !== "" &&
    endsOn !== "" &&
    (startsNow || startsOn !== "") &&
    (listId === null || isDirty);

  const onSave = async () => {
    setRefusal(null);
    const result: ActionResult<ListDetail> = await save.run({
      name: name.trim(),
      startsOn: startsNow ? null : startsOn,
      endsOn,
      targetPages: target,
      memberIds: [...members.current],
      generated: generation?.provenance,
    });
    if (!result.isDone) {
      setRefusal(result.refusal);
      return;
    }

    fields.commit();
    members.commit();
    setGeneration(null);
    setLeaveTo(`/lists?id=${encodeURIComponent(result.value.row.list.id)}`);
  };

  const onDiscard = () => {
    fields.reset();
    members.reset();
    setGeneration(null);
    setLeaveTo(backHref);
  };

  // The picks join what is there, and the pages asked become the list's target.
  const takeDraft = (draft: GenerationDraft) => {
    const next = new Map(reasons);
    for (const { item, reason } of draft.picks) {
      known.set(item.iteration.id, item);
      next.set(item.iteration.id, reason);
    }

    setReasons(next);
    members.set(new Set([...members.current, ...draft.picks.map(({ item }) => item.iteration.id)]));
    fields.set({ ...fields.current, target: String(draft.requestedPages) });
    setGeneration(draft);
    setMixBy(draft.shapedBy.intentionId);
    setAllocation(null);
    setIsReportShown(true);
  };

  const leafOf = (id: string) => categories.find((category) => category.id === id)?.name ?? id;
  const columns = listEditorColumns(leafOf);
  const card = {
    eyebrow: (item: ListItem) => (
      <>
        <span className="font-mono">{documentIdentifierOf(item.document)}</span> ·{" "}
        {leafOf(item.iteration.categoryId)}
      </>
    ),
    title: (item: ListItem) => item.document.title,
    meta: (item: ListItem) => (
      <>
        <PriorityBadge priority={item.iteration.priority} />
        <span className="text-xs text-muted-foreground">
          {item.pages === null ? "—" : `${formatCount(item.pages)} pp`}
        </span>
      </>
    ),
  };

  return (
    <>
      <TransferEditor
        header={
          <EditorHeader
            listId={listId}
            fields={fields.current}
            onFieldsChange={(change) => fields.set({ ...fields.current, ...change })}
            pages={pages}
            target={target}
            lateCopies={lateCopies}
            intentions={
              <IntentionsStrip
                reading={reading}
                shapes={shapes}
                mixBy={mixBy}
                onMixByChange={setMixBy}
                hasTarget={target !== null}
                canOpen={canOpenIntentions}
                generatedWith={onList.length === 0 ? null : generatedWith}
                isDatesChanged={
                  listId !== null &&
                  (fields.current.startsNow !== fields.original.startsNow ||
                    fields.current.startsOn !== fields.original.startsOn)
                }
              />
            }
            report={
              generation !== null && isReportShown ? (
                <GenerationReport draft={generation} onDismiss={() => setIsReportShown(false)} />
              ) : null
            }
            refusal={refusal}
          />
        }
        draft={members}
        isOtherwiseDirty={isOtherwiseDirty}
        rowId={(item) => item.iteration.id}
        target={{
          title: "On this list",
          summary: `${plural(onList.length, "item")} · ${formatCount(pages)} pp`,
          items: onList,
          columns,
          card,
          action:
            generators.length === 0
              ? undefined
              : { id: "generate", label: "Generate…", onSelect: () => setIsGenerating(true) },
          whyOf: (item) => <OnListWhy item={item} reason={reasons.get(item.iteration.id)} />,
          emptyText: (
            <>
              <b className="font-semibold text-foreground">Nothing on it yet.</b> Add documents from
              the ready ones
              {generators.length > 0 ? ", or generate a draft and adjust it." : "."}
              {generators.length === 0 && (
                <span className="mt-1 block">
                  No list generator is configured, so lists are built by hand.
                </span>
              )}
            </>
          ),
        }}
        source={{
          title: "Ready to list",
          summary:
            poolCount === null ? "" : `${poolCount.total} · ${formatCount(poolCount.pages)} pp`,
          items: pool.items === undefined ? undefined : [...takenOff, ...ready],
          columns,
          card,
          filter: (
            <PoolFilter
              search={search}
              onSearchChange={setSearch}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              categories={categories}
              properties={{
                definitions: filterablePropertiesOf(propertyIndex?.definitions, false),
                params: propertyParams,
                facets: pool.summary?.propertyFacets,
                onChange: setPropertyParams,
              }}
            />
          ),
          whyOf: (item) => <PoolWhy item={item} isTakenOff={originalIds.has(item.iteration.id)} />,
          footnote:
            pool.summary === undefined ? undefined : (
              <PoolFootnote pool={pool.summary} categoryName={leafOf} />
            ),
          emptyText: "Nothing ready matches.",
          failure: failureOf(pool, "Could not load what is ready to list."),
          resetKey: poolQuery,
          paging: pool.paging,
        }}
        unchangedText={listId === null ? "new — not saved" : "no changes"}
        canSave={canSave}
        isSaving={save.isPending}
        onSave={() => void onSave()}
        onDiscard={onDiscard}
      />
      {isGenerating && generators.length > 0 && (
        <GenerateDialog
          isOpen
          onClose={() => setIsGenerating(false)}
          generators={generators}
          memberIds={[...members.current]}
          memberPages={pages}
          target={allocation === null ? (target ?? start?.pages ?? null) : null}
          shapes={shapes}
          shapeId={mixBy}
          allocation={allocation}
          onDropAllocation={() => setAllocation(null)}
          onDraft={takeDraft}
        />
      )}
    </>
  );
}

export function listEditorColumns(
  leafOf: (categoryId: string) => string,
): ColumnDefinition<ListItem>[] {
  return [
    {
      key: "document",
      header: "Document",
      track: "minmax(9rem,1fr)",
      cell: (item) => (
        <>
          <span className="block leading-snug font-medium">{item.document.title}</span>
          <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground">
            {documentIdentifierOf(item.document)}
          </span>
        </>
      ),
    },
    {
      key: "category",
      header: "Category",
      track: "fit-content(8rem)",
      cell: (item) => <Muted>{leafOf(item.iteration.categoryId)}</Muted>,
    },
    {
      key: "priority",
      header: "Priority",
      track: "fit-content(5rem)",
      cell: (item) => <PriorityBadge priority={item.iteration.priority} />,
    },
    {
      key: "pages",
      header: "Pages",
      track: "max-content",
      isNumeric: true,
      cell: (item) => (item.pages === null ? <Muted>—</Muted> : formatCount(item.pages)),
    },
  ];
}

function LateCopy({ item }: { item: ListItem }) {
  if (item.lateCopy === null) {
    return null;
  }

  return (
    <>
      <b className="font-semibold text-tone-amber-foreground">
        ⚠ {item.lateCopy.source}: {item.lateCopy.state.toLowerCase()} since{" "}
        {formatDay(item.lateCopy.seenAt)}
      </b>{" "}
      — a copy appeared after approval. Look before listing it.
    </>
  );
}

function OnListWhy({ item, reason }: { item: ListItem; reason: string | undefined }) {
  const generated =
    reason === undefined ? null : (
      <>
        <ToneBadge tone="purple">generated</ToneBadge> {reason}
      </>
    );
  if (item.blocker !== null) {
    return (
      <b className="font-semibold text-tone-amber-foreground">
        ⚠ Blocked since listing — take it off if it should not be scanned
      </b>
    );
  }

  if (item.lateCopy === null) {
    return generated;
  }

  return (
    <>
      {generated}
      {generated !== null && " · "}
      <LateCopy item={item} />
    </>
  );
}

function PoolWhy({ item, isTakenOff }: { item: ListItem; isTakenOff: boolean }) {
  if (isTakenOff) {
    return (
      <>
        <b className="font-semibold text-foreground">Taken off</b> — back to Ready when you save
      </>
    );
  }

  return item.lateCopy === null ? null : <LateCopy item={item} />;
}

interface PoolFootnoteProps {
  pool: {
    inReview: { categoryId: string; itemCount: number; pages: number }[];
    undecidedCount: number;
    cancelledCount: number;
  };
  categoryName: (categoryId: string) => string;
}

// What review still holds back, so a short pool explains itself (decided 2026-09-26).
function PoolFootnote({ pool, categoryName }: PoolFootnoteProps) {
  const waiting = [
    ...pool.inReview.map(
      (held) =>
        `${held.itemCount} more in ${categoryName(held.categoryId)} (${formatCount(held.pages)} pp, in Validations)`,
    ),
    pool.undecidedCount > 0 ? `${plural(pool.undecidedCount, "proposal")} not decided yet` : null,
  ].filter((part) => part !== null);

  return (
    <>
      {waiting.length > 0 && (
        <p>
          <b className="font-semibold text-foreground">Waiting in review:</b> {waiting.join(" · ")}.
          They join the pool once review lets them through.
        </p>
      )}
      {pool.cancelledCount > 0 && (
        <p className="mt-1.5">
          Not shown: {pool.cancelledCount} Ready but cancelled. Resuming it in Documents brings it
          back here.
        </p>
      )}
    </>
  );
}

interface PoolFilterProps {
  search: string;
  onSearchChange: (search: string) => void;
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  categories: readonly Category[];
  // DOC-property-filter: the pool narrowed by its items' properties.
  properties: PropertyFilterProps;
}

// The category tree as a filter rather than a third pane (view-map.md §2.4).
function PoolFilter({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  properties,
}: PoolFilterProps) {
  const tops = categories.filter((category) => category.parentId === null);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  return (
    <>
      <Input
        aria-label="Search what is ready"
        placeholder="Search"
        className="h-7 w-32 text-xs"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        aria-label="Category"
        className="h-7 rounded-md border bg-background px-2 text-xs"
        value={categoryId}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">Every category</option>
        {tops.map((top) => (
          <optgroup key={top.id} label={top.name}>
            <option value={top.id}>All of {top.name}</option>
            {childrenOf(top.id).map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <PropertyFilterControls properties={properties} />
    </>
  );
}

interface EditorHeaderProps {
  listId: string | null;
  fields: ListFields;
  onFieldsChange: (change: Partial<ListFields>) => void;
  pages: number;
  target: number | null;
  lateCopies: number;
  // What it counts towards and its mix.
  intentions: ReactNode;
  // What the last generation made of its request.
  report: ReactNode;
  refusal: Refusal | null;
}

function EditorHeader({
  listId,
  fields,
  onFieldsChange,
  pages,
  target,
  lateCopies,
  intentions,
  report,
  refusal,
}: EditorHeaderProps) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Name"
          placeholder="Name the list — e.g. Periodicals, October"
          className="h-8 min-w-48 flex-1 font-semibold sm:max-w-80"
          value={fields.name}
          onChange={(event) => onFieldsChange({ name: event.target.value })}
        />
        {listId !== null && (
          <span className="font-mono text-xs text-muted-foreground">{listId}</span>
        )}
        <select
          aria-label="When it starts"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={fields.startsNow ? "now" : "on"}
          onChange={(event) => onFieldsChange({ startsNow: event.target.value === "now" })}
        >
          <option value="now">Starts now</option>
          <option value="on">Starts on</option>
        </select>
        {!fields.startsNow && (
          <Input
            type="date"
            aria-label="Starts on"
            className="h-8 w-auto"
            value={fields.startsOn}
            onChange={(event) => onFieldsChange({ startsOn: event.target.value })}
          />
        )}
        <label htmlFor={`${id}-ends`} className="text-sm text-muted-foreground">
          ends
        </label>
        <Input
          id={`${id}-ends`}
          type="date"
          className="h-8 w-auto"
          value={fields.endsOn}
          onChange={(event) => onFieldsChange({ endsOn: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Pages
        </span>
        <b className="font-semibold tabular-nums">{formatCount(pages)}</b>
        <span className="text-muted-foreground">of</span>
        <Input
          aria-label="Target pages"
          inputMode="numeric"
          placeholder="target"
          className="h-7 w-24 text-sm"
          value={fields.target}
          onChange={(event) => onFieldsChange({ target: event.target.value })}
        />
        <span className="h-1 w-28 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full bg-chart-3"
            style={{ width: `${target === null ? 0 : Math.min(100, (pages / target) * 100)}%` }}
          />
        </span>
      </div>

      {intentions}
      {report}
      {lateCopies > 0 && (
        <StatusNote
          tone="amber"
          title={`${plural(lateCopies, "item")} on this list ${lateCopies === 1 ? "has" : "have"} a copy that appeared after approval`}
        >
          Nobody decided over it — it is listed only if you mean it.
        </StatusNote>
      )}
      {refusal !== null && (
        <StatusNote tone="red" title="Not saved">
          {refusal.message}
        </StatusNote>
      )}
    </div>
  );
}

interface IntentionsStripProps {
  reading: ListReading | undefined;
  shapes: readonly ListShape[];
  mixBy: string | null;
  onMixByChange: (intentionId: string) => void;
  hasTarget: boolean;
  canOpen: boolean;
  // What it was generated with, while something is on it.
  generatedWith: { id: string; name: string } | null;
  isDatesChanged: boolean;
}

// Read-only: what it counts towards follows from what is on it and when it starts (§5).
function IntentionsStrip({
  reading,
  shapes,
  mixBy,
  onMixByChange,
  hasTarget,
  canOpen,
  generatedWith,
  isDatesChanged,
}: IntentionsStripProps) {
  if (reading === undefined) {
    return null;
  }

  const overall = shapes.find((shape) => shape.isOverall);
  const generatedShape = shapes.find((shape) => shape.id === generatedWith?.id);
  const isGeneratedCounted =
    generatedWith === null ||
    reading.countsTowards.some((row) => row.intentionId === generatedWith.id);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
          title="Worked out from what is on it and when it starts — nothing to tick"
        >
          Counts towards
        </span>
        <CountsTowardsLine rows={reading.countsTowards} canOpen={canOpen} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Mix
          </span>
          <select
            aria-label="Read the fill against"
            title="Which intention's mix to read the fill against"
            className="h-7 max-w-48 rounded-md border bg-background px-2 text-xs"
            value={mixBy ?? overall?.id ?? ""}
            onChange={(event) => onMixByChange(event.target.value)}
          >
            {shapes.map((shape) => (
              <option key={shape.id} value={shape.id}>
                {shape.name}
              </option>
            ))}
          </select>
        </label>
        <MixMeters mix={reading.mix} hasTarget={hasTarget} />
      </div>
      {!isGeneratedCounted && generatedWith !== null && (
        <StatusNote
          tone="amber"
          title={`Generated with ${generatedWith.name}, but it will not count towards it`}
        >
          {generatedShape === undefined
            ? "It counts lists starting inside its window"
            : `${generatedShape.name} counts lists starting ${generatedShape.endsOn === null ? `from ${formatCalendarDay(generatedShape.countsFrom)}` : `${formatCalendarDay(generatedShape.countsFrom)} → ${formatCalendarDay(generatedShape.endsOn)}`}`}
          ; this one starts {formatCalendarDay(reading.startsOn)}. Move the start into that window
          if it should.
        </StatusNote>
      )}
      {isDatesChanged && reading.stopsCountingTowards.length > 0 && (
        <StatusNote
          tone="amber"
          title={`Saving with these dates, it stops counting towards ${reading.stopsCountingTowards.map((row) => row.name).join(", ")}`}
        >
          {reading.stopsCountingTowards.length === 1 ? "That intention counts" : "They count"} lists
          starting inside {reading.stopsCountingTowards.length === 1 ? "its" : "their"} window; this
          one would start {formatCalendarDay(reading.startsOn)}.
        </StatusNote>
      )}
    </div>
  );
}
