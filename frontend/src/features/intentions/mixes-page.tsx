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
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
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

const mixQueryKey = ["mixes"] as const;
type Editor = "new" | "copy" | "snapshot" | "archive" | "delete" | "set" | null;

export function MixesPage() {
  const { mixId } = useParams();
  const view = useViewUrlState(mixesView, "mixId");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: mixes = [] } = useQuery({ queryKey: mixQueryKey, queryFn: listMixes });
  const { data: selected } = useQuery({
    queryKey: [...mixQueryKey, mixId],
    queryFn: () => getMix(mixId ?? ""),
    enabled: mixId !== undefined,
  });
  const current = selected ?? mixes.find((mix) => mix.id === mixId) ?? null;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<ReadonlySet<string>>(new Set());
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState("");
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
    if (!result.isDone) setMessage(result.refusal?.message ?? "The change could not be saved.");
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
        name: name.trim(),
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
        title="Category mixes"
        actions={[
          ...(mayEdit
            ? [
                {
                  id: "new",
                  label: "New mix",
                  isPrimary: true,
                  onSelect: () => {
                    setName("");
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
        searchLabel="Search category mixes"
        searchPlaceholder="Search category mixes"
      />
      <MasterDetail
        masterWidth="tree"
        master={
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
                        Primary
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {mix.archivedAt === null ? `Revision ${mix.revision}` : "Archived"} ·{" "}
                    {mix.usageCount} intentions ·{" "}
                    {complete(mix) ? "Complete" : "Has unallocated shares"}
                  </span>
                </Link>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">No mixes match this search.</p>
            )}
          </div>
        }
        detail={
          current === null ? (
            <p className="text-sm text-muted-foreground">
              Select a mix to see its definition and proportions.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl leading-7 font-semibold">{current.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current.archivedAt === null ? `Revision ${current.revision}` : "Archived"}
                </p>
                {(mayEdit || mayManage) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mayEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setName(`${current.name} copy`);
                          setRevision((selected) => selected ?? current.revision);
                          setEditor("copy");
                        }}
                      >
                        Create editable copy
                      </Button>
                    )}
                    {mayManage && current.archivedAt === null && !current.isPrimary && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void act(() => primary.run(current.id))}
                        >
                          Make Primary
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditor("archive")}>
                          Archive
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
                        Delete…
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
              <DetailCard title="Definition">
                <p>
                  {current.isPrimary
                    ? "Primary mix · default for new mix selections"
                    : "Reusable mix"}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {complete(current)
                    ? "All category sets total 100%."
                    : "Some category sets have unallocated shares."}
                </p>
                <FinePrint>
                  Editing proportions creates a new immutable revision. Intentions following latest
                  will read it; snapshots stay on their selected revision.
                </FinePrint>
              </DetailCard>
              <DetailCard title="Where used">
                {current.followers.length === 0 ? (
                  <p className="text-muted-foreground">No visible intentions use this mix.</p>
                ) : (
                  current.followers.map((follower) => (
                    <DetailRow
                      key={follower.id}
                      aside={follower.isArchived ? "Archived" : "Active"}
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
                title="Revisions and snapshots"
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
                      Name snapshot
                    </Button>
                  ) : undefined
                }
              >
                {current.revisions.toReversed().map((version) => (
                  <DetailRow
                    key={version.revision}
                    aside={version.label ?? new Date(version.at).toLocaleDateString()}
                  >
                    <button
                      type="button"
                      onClick={() => setRevision(version.revision)}
                      className="text-primary hover:underline"
                    >
                      Revision {version.revision}
                    </button>
                  </DetailRow>
                ))}
                <FinePrint>
                  Choose a revision, then Create editable copy to start another mix from it.
                </FinePrint>
              </DetailCard>
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Category proportions
                  </h2>
                  <Input
                    type="search"
                    aria-label="Search mix categories"
                    placeholder="Search categories…"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    className="mt-3"
                  />
                  <div className="mt-2 flex justify-end gap-3 pr-4 text-xs text-muted-foreground">
                    <span className="w-14 text-right">In parent</span>
                    <span className="w-14 text-right">Overall</span>
                  </div>
                </div>
                <Tree
                  ariaLabel="Mix category proportions"
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
                      ? `${unallocated}% unallocated within ${category.name}`
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
                    label: "All categories",
                    value: (
                      <span className="flex gap-3">
                        <span className="w-14 text-right">100%</span>
                        <span className="w-14 text-right text-muted-foreground">100%</span>
                      </span>
                    ),
                    warning:
                      unallocatedOf(current, null) > 0
                        ? `${unallocatedOf(current, null)}% unallocated at top level`
                        : null,
                  }}
                />
                {visibleCategoryIds?.size === 0 && (
                  <p className="px-4 py-5 text-sm text-muted-foreground">No categories match.</p>
                )}
              </div>
              <DetailCard
                title={
                  categoryId === null
                    ? "Top-level proportions"
                    : `Within ${categories.find((category) => category.id === categoryId)?.name ?? "category"}`
                }
                action={
                  mayEdit && current.archivedAt === null && children.length > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setEditor("set")}>
                      Edit proportions
                    </Button>
                  ) : undefined
                }
              >
                <p>
                  {children.length} {children.length === 1 ? "category" : "categories"} ·{" "}
                  {unallocatedOf(current, categoryId)}% unallocated
                </p>
                <FinePrint>
                  Select a branch to edit its children, or a leaf to edit its siblings. Each edit
                  creates a new revision.
                </FinePrint>
              </DetailCard>
            </div>
          )
        }
        detailTitle={current?.name ?? "Mix details"}
        detailOpen={mixId !== undefined && current !== null}
        onDetailOpenChange={(open) => {
          if (!open) navigate({ pathname: "/mixes", search: location.search });
        }}
      />
      {current !== null && editor === "set" && (
        <SetEditorDialog<{ id: string; name: string; share: number | null }>
          key={`${current.id}:${categoryId ?? "root"}:${current.revision}`}
          isOpen
          onClose={() => setEditor(null)}
          title="Edit proportions"
          description={`Changes to ${current.name} will create a new revision.`}
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
              ? "Use percentages from 0 to 100."
              : entries.reduce((sum, entry) => sum + (entry.share ?? 0), 0) > 100
                ? "A set cannot exceed 100%."
                : null
          }
          summaryOf={(entries) => (
            <p className="text-sm text-muted-foreground">
              Unallocated: {100 - entries.reduce((sum, entry) => sum + (entry.share ?? 0), 0)}%
            </p>
          )}
          submitLabel="Save new revision"
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
          title={editor === "copy" ? "Create editable copy" : "New mix"}
          description="A reusable category allocation."
          primary={{
            label: "Create mix",
            isDisabled: name.trim() === "",
            isPending: create.isPending,
            onSelect: () => void createCurrent(),
          }}
        >
          {message !== null && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <Label htmlFor="mix-name">Name</Label>
          <Input id="mix-name" value={name} onChange={(event) => setName(event.target.value)} />
          {editor === "copy" && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="copy-revision">Copy revision from {current?.name}</Label>
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
                      Revision {version.revision}
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
          title="Name snapshot"
          description="Name an immutable revision for later reuse."
          primary={{
            label: "Save snapshot",
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
          <p className="mb-3 text-sm">Revision {revision ?? current.revision}</p>
          <Label htmlFor="snapshot-label">Snapshot name</Label>
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
          title={`Archive ${current.name}?`}
          description="The final revision remains readable. Active followers are pinned to it."
          primary={{
            label: "Archive mix",
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
          <p className="text-sm">
            This mix will no longer be offered for new selections. {current.usageCount} visible
            intentions currently use it.
          </p>
        </DialogShell>
      )}
      {current !== null && (
        <ConsequenceDialog
          isOpen={editor === "delete"}
          onClose={() => setEditor(null)}
          title={`Delete ${current.name}?`}
          description="This permanently removes the unused mix and its revisions."
          consequences={[
            { text: "No intention, repeat or list has used it, so nothing else changes." },
          ]}
          confirmLabel="Delete mix"
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
