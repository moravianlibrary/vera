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
import { useTranslation } from "react-i18next";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatCount, formatPages } from "@/lib/format-number";

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
  const { t } = useTranslation("lists");
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
      "list.member_unavailable": t("listEditor.memberUnavailable"),
      "list.done": t("listEditor.doneMeanwhile"),
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
          {item.pages === null ? "—" : formatPages(item.pages)}
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
          title: t("listEditor.onThisList"),
          summary: `${t("listEditor.item", { count: onList.length })} · ${formatPages(pages)}`,
          items: onList,
          columns,
          card,
          action:
            generators.length === 0
              ? undefined
              : {
                  id: "generate",
                  label: t("listEditor.generate"),
                  onSelect: () => setIsGenerating(true),
                },
          whyOf: (item) => <OnListWhy item={item} reason={reasons.get(item.iteration.id)} />,
          emptyText: (
            <>
              <b className="font-semibold text-foreground">{t("listEditor.nothingOnList")}</b>{" "}
              {t("listEditor.addReady")}
              {generators.length > 0 ? t("listEditor.orGenerate") : "."}
              {generators.length === 0 && (
                <span className="mt-1 block">{t("listEditor.noGenerator")}</span>
              )}
            </>
          ),
        }}
        source={{
          title: t("listEditor.readyToList"),
          summary: poolCount === null ? "" : `${poolCount.total} · ${formatPages(poolCount.pages)}`,
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
          emptyText: t("listEditor.nothingReadyMatches"),
          failure: failureOf(pool, t("listEditor.loadReadyFailure")),
          resetKey: poolQuery,
          paging: pool.paging,
        }}
        unchangedText={listId === null ? t("listEditor.newNotSaved") : t("listEditor.noChanges")}
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
      header: "lists:listEditor.document",
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
      header: "lists:listEditor.category",
      track: "fit-content(8rem)",
      cell: (item) => <Muted>{leafOf(item.iteration.categoryId)}</Muted>,
    },
    {
      key: "priority",
      header: "lists:listEditor.priority",
      track: "fit-content(5rem)",
      cell: (item) => <PriorityBadge priority={item.iteration.priority} />,
    },
    {
      key: "pages",
      header: "lists:listEditor.pages",
      track: "max-content",
      isNumeric: true,
      cell: (item) => (item.pages === null ? <Muted>—</Muted> : formatCount(item.pages)),
    },
  ];
}

function LateCopy({ item }: { item: ListItem }) {
  const { t } = useTranslation("lists");
  if (item.lateCopy === null) {
    return null;
  }

  return (
    <>
      <b className="font-semibold text-tone-amber-foreground">
        ⚠ {item.lateCopy.source}: {item.lateCopy.state.toLowerCase()} since{" "}
        {formatDay(item.lateCopy.seenAt)}
      </b>{" "}
      — {t("listEditor.lateCopy")}
    </>
  );
}

function OnListWhy({ item, reason }: { item: ListItem; reason: string | undefined }) {
  const { t } = useTranslation("lists");
  const generated =
    reason === undefined ? null : (
      <>
        <ToneBadge tone="purple">{t("listEditor.generated")}</ToneBadge> {reason}
      </>
    );
  if (item.blocker !== null) {
    return <b className="font-semibold text-tone-amber-foreground">{t("listEditor.blocked")}</b>;
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
  const { t } = useTranslation("lists");
  if (isTakenOff) {
    return (
      <>
        <b className="font-semibold text-foreground">{t("listEditor.takenOff")}</b> —{" "}
        {t("listEditor.backToReady")}
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
  const { t } = useTranslation("lists");
  const waiting = [
    ...pool.inReview.map((held) =>
      t("listEditor.waitingItem", {
        count: held.itemCount,
        category: categoryName(held.categoryId),
        pages: formatCount(held.pages),
      }),
    ),
    pool.undecidedCount > 0
      ? t("listEditor.undecidedProposal", { count: pool.undecidedCount })
      : null,
  ].filter((part) => part !== null);

  return (
    <>
      {waiting.length > 0 && (
        <p>
          <b className="font-semibold text-foreground">{t("listEditor.waitingInReview")}</b>{" "}
          {waiting.join(" · ")}.{t("listEditor.reviewAllows")}
        </p>
      )}
      {pool.cancelledCount > 0 && (
        <p className="mt-1.5">
          {t("listEditor.cancelledNotShown", { count: pool.cancelledCount })}
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
  const { t } = useTranslation("lists");
  const tops = categories.filter((category) => category.parentId === null);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  return (
    <>
      <Input
        aria-label={t("listEditor.searchReady")}
        placeholder={t("listEditor.search")}
        className="h-7 w-32 text-xs"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select
        value={categoryId || "__all_categories__"}
        onValueChange={(value) => onCategoryChange(value === "__all_categories__" ? "" : value)}
      >
        <SelectTrigger aria-label={t("listEditor.category")} className="h-7 w-auto px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all_categories__">{t("listEditor.everyCategory")}</SelectItem>
          {tops.map((top) => (
            <SelectGroup key={top.id}>
              <SelectLabel>{top.name}</SelectLabel>
              <SelectItem value={top.id}>{t("listEditor.allOf", { name: top.name })}</SelectItem>
              {childrenOf(top.id).map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
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
  const { t } = useTranslation("lists");
  const id = useId();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t("listEditor.name")}
          placeholder={t("listEditor.namePlaceholder")}
          className="h-8 min-w-48 flex-1 font-semibold sm:max-w-80"
          value={fields.name}
          onChange={(event) => onFieldsChange({ name: event.target.value })}
        />
        {listId !== null && (
          <span className="font-mono text-xs text-muted-foreground">{listId}</span>
        )}
        <Select
          value={fields.startsNow ? "now" : "on"}
          onValueChange={(value) => onFieldsChange({ startsNow: value === "now" })}
        >
          <SelectTrigger
            aria-label={t("listEditor.whenStarts")}
            className="h-8 w-auto px-2 text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">{t("listEditor.startsNow")}</SelectItem>
            <SelectItem value="on">{t("listEditor.startsOn")}</SelectItem>
          </SelectContent>
        </Select>
        {!fields.startsNow && (
          <Input
            type="date"
            aria-label={t("listEditor.startsOn")}
            className="h-8 w-auto"
            value={fields.startsOn}
            onChange={(event) => onFieldsChange({ startsOn: event.target.value })}
          />
        )}
        <label htmlFor={`${id}-ends`} className="text-sm text-muted-foreground">
          {t("listEditor.ends")}
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
          {t("listEditor.pages")}
        </span>
        <b className="font-semibold tabular-nums">{formatCount(pages)}</b>
        <span className="text-muted-foreground">{t("listEditor.of")}</span>
        <Input
          aria-label={t("listEditor.targetPages")}
          inputMode="numeric"
          placeholder={t("listEditor.target")}
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
        <StatusNote tone="amber" title={t("listEditor.lateCopyTitle", { count: lateCopies })}>
          {t("listEditor.lateCopyBody")}
        </StatusNote>
      )}
      {refusal !== null && (
        <StatusNote tone="red" title={t("listEditor.notSaved")}>
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
  const { t } = useTranslation("lists");
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
          title={t("listEditor.countsTowardsTitle")}
        >
          {t("listEditor.countsTowards")}
        </span>
        <CountsTowardsLine rows={reading.countsTowards} canOpen={canOpen} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("listEditor.mix")}
          </span>
          <Select value={mixBy ?? overall?.id ?? shapes[0]?.id ?? ""} onValueChange={onMixByChange}>
            <SelectTrigger
              aria-label={t("listEditor.readFillAgainst")}
              title={t("listEditor.readFillTitle")}
              className="h-7 w-auto max-w-48 px-2 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shapes.map((shape) => (
                <SelectItem key={shape.id} value={shape.id}>
                  {shape.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <MixMeters mix={reading.mix} hasTarget={hasTarget} />
      </div>
      {!isGeneratedCounted && generatedWith !== null && (
        <StatusNote
          tone="amber"
          title={t("listEditor.generatedNotCounted", { name: generatedWith.name })}
        >
          {generatedShape === undefined
            ? t("listEditor.countsInsideWindow")
            : t("listEditor.shapeCounts", {
                name: generatedShape.name,
                starts: formatCalendarDay(generatedShape.countsFrom),
                ends:
                  generatedShape.endsOn === null
                    ? ""
                    : ` → ${formatCalendarDay(generatedShape.endsOn)}`,
              })}
          {t("listEditor.moveStartIntoWindow", { date: formatCalendarDay(reading.startsOn) })}
        </StatusNote>
      )}
      {isDatesChanged && reading.stopsCountingTowards.length > 0 && (
        <StatusNote
          tone="amber"
          title={t("listEditor.stopsCounting", {
            names: reading.stopsCountingTowards.map((row) => row.name).join(", "),
          })}
        >
          {t("listEditor.stopsCountingBody", {
            count: reading.stopsCountingTowards.length,
            date: formatCalendarDay(reading.startsOn),
          })}
        </StatusNote>
      )}
    </div>
  );
}
