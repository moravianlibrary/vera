// Shape: Master–detail.
// Independent, reusable mix definitions. A mix has percentages and revisions, but no output of
// its own; output comparisons remain on an intention and its reporting window.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MixRecord } from "@vera/contract/mix-catalog";
import {
  hasUnallocatedProportions,
  matchingMixes,
  mixPrimaries,
  mixProportions,
  mixStates,
} from "@vera/contract/mix-filters";
import { categoryPathOf, searchedCategoriesOf } from "@vera/domain/categories";
import type { Names } from "@vera/domain/names";
import { namesToSave } from "@vera/domain/names";
import { can } from "@vera/domain/permissions";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  archiveMix,
  createMix,
  deleteMix,
  getMix,
  listMixes,
  makePrimaryMix,
  saveMixSetById,
  snapshotMix,
} from "@/api/mix-catalog";
import { DetailCard, DetailRow, FinePrint } from "@/components/detail-card";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { SetEditorDialog } from "@/components/dialogs/set-editor-dialog";
import { NamesField } from "@/components/fields/names-field";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import { failureOf, QueryError, QueryState } from "@/components/query-state";
import { Tree } from "@/components/tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mixesView } from "@/features/intentions/mixes-view";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";
import { formatLongDay } from "@/lib/format-date";

const mixQueryKey = ["mixes"] as const;
type Editor = "new" | "copy" | "snapshot" | "archive" | "delete" | "set" | null;
const msg = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: key.startsWith("categoriesPage.") ? "categories" : "intentions", ...options });

export function MixesPage() {
  const { mixId } = useParams();
  const view = useViewUrlState(mixesView, "mixId");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const mixesQuery = useQuery({ queryKey: mixQueryKey, queryFn: listMixes });
  const { data: mixes = [] } = mixesQuery;
  const selectedQuery = useQuery({
    queryKey: [...mixQueryKey, mixId],
    queryFn: () => getMix(mixId ?? ""),
    enabled: mixId !== undefined,
  });
  const { data: selected } = selectedQuery;
  const selectedFailure = failureOf(selectedQuery, msg("mixesPage.loadError"));
  const current = selected ?? mixes.find((mix) => mix.id === mixId) ?? null;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<ReadonlySet<string>>(new Set());
  const [editor, setEditor] = useState<Editor>(null);
  const [names, setNames] = useState<Names>({});
  const [label, setLabel] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const invalidates = [
    mixQueryKey,
    ["intentions"],
    ["reference", "categories"],
    watchlistsQueryKey,
  ];
  const create = useActionMutation({ call: createMix, invalidates });
  const primary = useActionMutation({ call: makePrimaryMix, invalidates });
  const archive = useActionMutation({ call: archiveMix, invalidates });
  const remove = useActionMutation({ call: deleteMix, invalidates });
  const snapshot = useActionMutation({
    call: (draft: { mixId: string; revision: number; label: string }) =>
      snapshotMix(draft.mixId, draft),
    invalidates,
  });
  const saveSet = useActionMutation({
    call: (draft: {
      mixId: string;
      parentId: string | null;
      shares: Record<string, number | null>;
      revision: number;
    }) => saveMixSetById(draft.mixId, draft),
    invalidates,
  });

  const filtered = matchingMixes(mixes, categories, view.query);
  const facets = {
    states: mixStates.map((value) => ({
      value,
      count: matchingMixes(mixes, categories, { ...view.query, states: [value] }).length,
    })),
    primaries: mixPrimaries.map((value) => ({
      value,
      count: matchingMixes(mixes, categories, { ...view.query, primaries: [value] }).length,
    })),
    proportions: mixProportions.map((value) => ({
      value,
      count: matchingMixes(mixes, categories, { ...view.query, proportions: [value] }).length,
    })),
  };
  const mayEdit = session !== undefined && can(session, "mix.edit");
  const mayManage = session !== undefined && can(session, "mix.manage");
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const categoryId =
    selectedCategory === undefined ||
    categories.some((category) => category.parentId === selectedCategory.id)
      ? (selectedCategoryId ?? null)
      : selectedCategory.parentId;
  const children = categories.filter((category) => category.parentId === categoryId);
  const branchIds = categories
    .filter((category) => categories.some((child) => child.parentId === category.id))
    .map((category) => category.id);
  const visibleCategoryIds = searchedCategoriesOf(categories, categorySearch);
  const visibleChildrenOf = (parentId: string | null) =>
    categories.filter(
      (category) =>
        category.parentId === parentId &&
        (visibleCategoryIds === null || visibleCategoryIds.has(category.id)),
    );
  const expandedCategoryIds = new Set(
    visibleCategoryIds === null
      ? branchIds.filter((id) => !collapsedCategoryIds.has(id))
      : branchIds,
  );
  const unallocatedOf = (mix: MixRecord, parentId: string | null) =>
    Math.max(
      0,
      100 -
        categories
          .filter((category) => category.parentId === parentId)
          .reduce((sum, category) => sum + (mix.shares[category.id] ?? 0), 0),
    );
  const wholeShareOf = (mix: MixRecord, categoryId: string) => {
    const path = categoryPathOf(categories, categoryId);
    return path.some((category) => mix.shares[category.id] === undefined)
      ? null
      : path.reduce((share, category) => (share * mix.shares[category.id]) / 100, 100);
  };
  const complete = (mix: MixRecord) => !hasUnallocatedProportions(mix, categories);
  const act = async (
    run: () => Promise<{ isDone: boolean; value?: MixRecord; refusal?: { message: string } }>,
  ) => {
    const result = await run();
    if (!result.isDone) setMessage(result.refusal?.message ?? msg("mixesPage.saveError"));
    else {
      setMessage(null);
      setEditor(null);
      void queryClient.invalidateQueries({ queryKey: mixQueryKey });
    }
    return result;
  };
  const createCurrent = async () => {
    const result = await act(() =>
      create.run({
        names: namesToSave(names),
        fromMixId: editor === "copy" ? (current?.id ?? null) : null,
        fromRevision: editor === "copy" ? revision : null,
      }),
    );
    if (result.isDone && result.value)
      navigate({ pathname: `/mixes/${result.value.id}`, search: location.search });
  };
  return (
    <>
      <PageHeader
        title={msg("mixesPage.title")}
        actions={[
          ...(mayEdit
            ? [
                {
                  id: "new",
                  label: msg("mixesPage.newMix"),
                  isPrimary: true,
                  onSelect: () => {
                    setNames({});
                    setEditor("new");
                  },
                },
              ]
            : []),
        ]}
      />
      {session !== undefined && can(session, "watch") && (
        <WatchlistTabs
          view="mixes"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={can(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}
      <FilterBar
        key={view.filterReplacements}
        fields={mixesView.fields}
        query={view.query}
        facets={facets}
        onQueryChange={view.setQuery}
        searchLabel={msg("mixesPage.searchLabel")}
        searchPlaceholder={msg("mixesPage.searchPlaceholder")}
      />
      <MasterDetail
        masterWidth="tree"
        master={
          <QueryState
            isLoading={mixesQuery.isLoading}
            failure={failureOf(mixesQuery, msg("mixesPage.loadMixesError"))}
            loadingText={msg("mixesPage.loadingMixes")}
          >
            <div>
              {current === null && message !== null && (
                <p
                  role="alert"
                  className="m-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                >
                  {message}
                </p>
              )}
              <div>
                {filtered.map((mix) => (
                  <Link
                    key={mix.id}
                    to={{ pathname: `/mixes/${mix.id}`, search: location.search }}
                    onClick={() => {
                      setRevision(null);
                      setSelectedCategoryId(null);
                    }}
                    aria-current={mix.id === current?.id ? "page" : undefined}
                    className={`block border-b border-l-3 border-l-transparent px-4 py-2.5 text-sm hover:bg-muted ${mix.id === current?.id ? "border-l-primary bg-primary/8 hover:bg-primary/12" : ""}`}
                  >
                    <span className="block font-medium">
                      {mix.name}{" "}
                      {mix.isPrimary && (
                        <span className="ml-2 rounded-xs bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {msg("mixesPage.primary")}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {mix.archivedAt === null
                        ? msg("mixesPage.revision", { revision: mix.revision })
                        : msg("mixesPage.archived")}{" "}
                      · {msg("mixesPage.intentionsCount", { count: mix.usageCount })} ·{" "}
                      {complete(mix)
                        ? msg("mixesPage.complete")
                        : msg("mixesPage.unallocatedShares")}
                    </span>
                  </Link>
                ))}
              </div>
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {msg("mixesPage.noSearchMatches")}
                </p>
              )}
            </div>
          </QueryState>
        }
        detail={
          selectedFailure !== undefined ? (
            <QueryError failure={selectedFailure} />
          ) : current === null ? (
            <p className="text-sm text-muted-foreground">{msg("mixesPage.selectPrompt")}</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl leading-7 font-semibold">{current.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current.archivedAt === null
                    ? msg("mixesPage.revision", { revision: current.revision })
                    : msg("mixesPage.archived")}
                </p>
                {(mayEdit || mayManage) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mayEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNames({
                            ...current.names,
                            [i18n.language === "cs" ? "cs" : "en"]: msg("mixesPage.copyName", {
                              name: current.name,
                            }),
                          });
                          setRevision((selected) => selected ?? current.revision);
                          setEditor("copy");
                        }}
                      >
                        {msg("mixesPage.createCopy")}
                      </Button>
                    )}
                    {mayManage && current.archivedAt === null && !current.isPrimary && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void act(() => primary.run(current.id))}
                        >
                          {msg("mixesPage.makePrimary")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditor("archive")}>
                          {msg("mixesPage.archive")}
                        </Button>
                      </>
                    )}
                    {mayManage && !current.isPrimary && !current.everUsed && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setMessage(null);
                          setEditor("delete");
                        }}
                      >
                        {msg("mixesPage.delete")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {message !== null && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                >
                  {message}
                </p>
              )}
              <DetailCard title={msg("mixesPage.definition")}>
                <p>
                  {current.isPrimary
                    ? msg("mixesPage.primaryDefinition")
                    : msg("mixesPage.reusable")}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {complete(current)
                    ? msg("mixesPage.allSetsTotal100")
                    : msg("mixesPage.someSetsUnallocated")}
                </p>
                <FinePrint>{msg("mixesPage.definitionHelp")}</FinePrint>
              </DetailCard>
              <DetailCard title={msg("mixesPage.whereUsed")}>
                {current.followers.length === 0 ? (
                  <p className="text-muted-foreground">{msg("mixesPage.noIntentionsUse")}</p>
                ) : (
                  current.followers.map((follower) => (
                    <DetailRow
                      key={follower.id}
                      aside={
                        follower.isArchived ? msg("mixesPage.archived") : msg("mixesPage.active")
                      }
                    >
                      <Link
                        className="text-primary hover:underline"
                        to={`/intentions?i=${encodeURIComponent(follower.id)}`}
                      >
                        {follower.name}
                      </Link>
                    </DetailRow>
                  ))
                )}
              </DetailCard>
              <DetailCard
                title={msg("mixesPage.revisionsAndSnapshots")}
                action={
                  mayEdit && current.archivedAt === null ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevision(current.revision);
                        setLabel("");
                        setEditor("snapshot");
                      }}
                    >
                      {msg("mixesPage.nameSnapshot")}
                    </Button>
                  ) : undefined
                }
              >
                {current.revisions.toReversed().map((version) => (
                  <DetailRow
                    key={version.revision}
                    aside={version.label ?? formatLongDay(version.at)}
                  >
                    <button
                      type="button"
                      onClick={() => setRevision(version.revision)}
                      className="text-primary hover:underline"
                    >
                      {msg("mixesPage.revision", { revision: version.revision })}
                    </button>
                  </DetailRow>
                ))}
                <FinePrint>{msg("mixesPage.revisionHelp")}</FinePrint>
              </DetailCard>
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {msg("mixesPage.categoryProportions")}
                  </h2>
                  <Input
                    type="search"
                    aria-label={msg("mixesPage.searchCategories")}
                    placeholder={msg("mixesPage.searchCategoriesPlaceholder")}
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    className="mt-3"
                  />
                  <div className="mt-2 flex justify-end gap-3 pr-4 text-xs text-muted-foreground">
                    <span className="w-14 text-right">{msg("mixesPage.inParent")}</span>
                    <span className="w-14 text-right">{msg("intentionCard.overall")}</span>
                  </div>
                </div>
                <Tree
                  ariaLabel={msg("mixesPage.treeLabel")}
                  roots={visibleChildrenOf(null)}
                  childrenOf={(category) => visibleChildrenOf(category.id)}
                  nodeId={(category) => category.id}
                  label={(category) => category.name}
                  value={(category) => {
                    const share = current.shares[category.id];
                    const whole = wholeShareOf(current, category.id);
                    return (
                      <span className="flex gap-3">
                        <span className="w-14 text-right">
                          {share === undefined ? "—" : `${share}%`}
                        </span>
                        <span className="w-14 text-right text-muted-foreground">
                          {whole === null ? "—" : `${Number(whole.toFixed(2))}%`}
                        </span>
                      </span>
                    );
                  }}
                  warning={(category) => {
                    const unallocated = unallocatedOf(current, category.id);
                    return categories.some((child) => child.parentId === category.id) &&
                      unallocated > 0
                      ? msg("mixesPage.unallocatedWithin", {
                          percent: unallocated,
                          name: category.name,
                        })
                      : null;
                  }}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  expandedIds={expandedCategoryIds}
                  onExpandedChange={(expanded) =>
                    setCollapsedCategoryIds(
                      new Set(branchIds.filter((branchId) => !expanded.has(branchId))),
                    )
                  }
                  virtualRoot={{
                    label: msg("categoriesPage.allCategories"),
                    value: (
                      <span className="flex gap-3">
                        <span className="w-14 text-right">100%</span>
                        <span className="w-14 text-right text-muted-foreground">100%</span>
                      </span>
                    ),
                    warning:
                      unallocatedOf(current, null) > 0
                        ? msg("mixesPage.unallocatedTopLevel", {
                            percent: unallocatedOf(current, null),
                          })
                        : null,
                  }}
                />
                {visibleCategoryIds?.size === 0 && (
                  <p className="px-4 py-5 text-sm text-muted-foreground">
                    {msg("mixesPage.noCategoriesMatch")}
                  </p>
                )}
              </div>
              <DetailCard
                title={
                  categoryId === null
                    ? msg("mixesPage.topLevelProportions")
                    : msg("mixesPage.within", {
                        name:
                          categories.find((category) => category.id === categoryId)?.name ??
                          msg("mixesPage.category"),
                      })
                }
                action={
                  mayEdit && current.archivedAt === null && children.length > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setEditor("set")}>
                      {msg("mixesPage.editProportions")}
                    </Button>
                  ) : undefined
                }
              >
                <p>
                  {msg("mixesPage.childrenAndUnallocated", {
                    count: children.length,
                    percent: unallocatedOf(current, categoryId),
                  })}
                </p>
                <FinePrint>{msg("mixesPage.proportionsHelp")}</FinePrint>
              </DetailCard>
            </div>
          )
        }
        detailTitle={current?.name ?? msg("mixesPage.details")}
        detailOpen={mixId !== undefined && current !== null}
        onDetailOpenChange={(open) => {
          if (!open) navigate({ pathname: "/mixes", search: location.search });
        }}
        swipe={{
          items: filtered,
          idOf: (mix) => mix.id,
          labelOf: (mix) => mix.name,
          currentId: current?.id ?? null,
          onSelect: (id) => {
            setRevision(null);
            setSelectedCategoryId(null);
            navigate({ pathname: `/mixes/${id}`, search: location.search });
          },
        }}
      />
      {current !== null && editor === "set" && (
        <SetEditorDialog<{ id: string; name: string; share: number | null }>
          key={`${current.id}:${categoryId ?? "root"}:${current.revision}`}
          isOpen
          onClose={() => setEditor(null)}
          title={msg("mixesPage.editProportions")}
          description={msg("mixesPage.editDescription", { name: current.name })}
          entries={children.map((category) => ({
            id: category.id,
            name: category.name,
            share: current.shares[category.id] ?? null,
          }))}
          renderEntries={(entries, onChange) => (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                  <Label htmlFor={`share-${entry.id}`}>{entry.name}</Label>
                  <Input
                    id={`share-${entry.id}`}
                    type="number"
                    min={0}
                    max={100}
                    value={entry.share ?? ""}
                    onChange={(event) =>
                      onChange(
                        entries.map((item) =>
                          item.id === entry.id
                            ? {
                                ...item,
                                share:
                                  event.target.value === "" ? null : Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
          invalidReasonOf={(entries) =>
            entries.some(
              (entry) =>
                entry.share !== null &&
                (!Number.isFinite(entry.share) || entry.share < 0 || entry.share > 100),
            )
              ? msg("mixesPage.percentageRangeError")
              : entries.reduce((sum, entry) => sum + (entry.share ?? 0), 0) > 100
                ? msg("mixesPage.setExceeds100Error")
                : null
          }
          summaryOf={(entries) => (
            <p className="text-sm text-muted-foreground">
              {msg("mixesPage.unallocatedSummary", {
                percent: 100 - entries.reduce((sum, entry) => sum + (entry.share ?? 0), 0),
              })}
            </p>
          )}
          submitLabel={msg("mixesPage.saveRevision")}
          onSave={async (entries) =>
            saveSet.run({
              mixId: current.id,
              parentId: categoryId,
              revision: current.revision,
              shares: Object.fromEntries(entries.map((entry) => [entry.id, entry.share])),
            })
          }
        />
      )}
      {(editor === "new" || editor === "copy") && (
        <DialogShell
          isOpen
          onClose={() => setEditor(null)}
          title={editor === "copy" ? msg("mixesPage.createCopy") : msg("mixesPage.newMix")}
          description={msg("mixesPage.newDescription")}
          primary={{
            label: msg("mixesPage.createMix"),
            isDisabled: !names.cs?.trim() && !names.en?.trim(),
            isPending: create.isPending,
            onSelect: () => void createCurrent(),
          }}
        >
          {message !== null && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <NamesField
            id="mix-name"
            label={msg("mixesPage.name")}
            names={names}
            onChange={setNames}
          />
          {editor === "copy" && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="copy-revision">
                {msg("mixesPage.copyRevisionFrom", { name: current?.name })}
              </Label>
              <Select
                value={String(revision ?? current?.revision ?? 1)}
                onValueChange={(value) => setRevision(Number(value))}
              >
                <SelectTrigger id="copy-revision" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {current?.revisions.toReversed().map((version) => (
                    <SelectItem key={version.revision} value={String(version.revision)}>
                      {msg("mixesPage.revision", { revision: version.revision })}
                      {version.label ? ` · ${version.label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogShell>
      )}
      {current !== null && editor === "snapshot" && (
        <DialogShell
          isOpen
          onClose={() => setEditor(null)}
          title={msg("mixesPage.nameSnapshot")}
          description={msg("mixesPage.nameSnapshotDescription")}
          primary={{
            label: msg("mixesPage.saveSnapshot"),
            isDisabled: label.trim() === "",
            isPending: snapshot.isPending,
            onSelect: () =>
              void act(() =>
                snapshot.run({
                  mixId: current.id,
                  revision: revision ?? current.revision,
                  label: label.trim(),
                }),
              ),
          }}
        >
          {message !== null && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <p className="mb-3 text-sm">
            {msg("mixesPage.revision", { revision: revision ?? current.revision })}
          </p>
          <Label htmlFor="snapshot-label">{msg("mixesPage.snapshotName")}</Label>
          <Input
            id="snapshot-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </DialogShell>
      )}
      {current !== null && editor === "archive" && (
        <DialogShell
          isOpen
          onClose={() => setEditor(null)}
          title={msg("mixesPage.archiveTitle", { name: current.name })}
          description={msg("mixesPage.archiveDescription")}
          primary={{
            label: msg("mixesPage.archiveMix"),
            isDestructive: true,
            isPending: archive.isPending,
            onSelect: () => void act(() => archive.run(current.id)),
          }}
        >
          {message !== null && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <p className="text-sm">{msg("mixesPage.archiveNote", { count: current.usageCount })}</p>
        </DialogShell>
      )}
      {current !== null && (
        <ConsequenceDialog
          isOpen={editor === "delete"}
          onClose={() => setEditor(null)}
          title={msg("mixesPage.deleteTitle", { name: current.name })}
          description={msg("mixesPage.deleteDescription")}
          consequences={[{ text: msg("mixesPage.deleteConsequence") }]}
          confirmLabel={msg("mixesPage.deleteMix")}
          isDestructive
          onConfirm={async () => {
            const result = await remove.run(current.id);
            if (result.isDone) navigate({ pathname: "/mixes", search: location.search });
            return result;
          }}
        />
      )}
    </>
  );
}
