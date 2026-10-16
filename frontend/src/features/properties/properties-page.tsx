// Properties, under Administration (UI-pages): every property definition (DOC-property), each
// opening in its pane, for a holder of `property.define`. The predefined four are edited, never
// deleted (DOC-property-predefined); deleting another first says, from the server, what goes with
// it (DOC-property-delete). The open property lives at ?property=.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { NewProperty } from "@/api/properties";
import {
  createProperty,
  deleteProperty,
  fetchPropertyImpact,
  saveProperty,
} from "@/api/properties";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { DetailCard, FactGrid, FinePrint } from "@/components/detail-card";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import { NoticeLine } from "@/components/notice-line";
import { Pane, paneStateOf } from "@/components/pane-state";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/domain/permissions";
import type { PropertyDefinition } from "@/domain/properties";
import { editPermissionOf, mayBeEnteredByHand, propertyNameOf } from "@/domain/properties";
import {
  PropertyEditor,
  propertyRefusalTexts,
  subjectLabels,
  typeLabels,
  visibilityLabels,
} from "@/features/properties/property-editor";
import {
  propertyInvalidations,
  usePropertiesQuery,
} from "@/features/properties/use-properties-query";
import type { ActionResult } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useSessionQuery } from "@/hooks/use-session-query";
import { plural } from "@/lib/plural";

const selectedParam = "property";
const localPaging = { hasMore: false, isLoadingMore: false, onLoadMore: () => {} };

// "One of a set of values · 5", "List of numbers in cm".
export function typeTextOf(definition: PropertyDefinition): string {
  const { type } = definition;
  const base =
    type.kind === "enum"
      ? `${typeLabels.enum} · ${type.values.length}`
      : type.kind === "number" && type.unit !== ""
        ? `${typeLabels.number} in ${type.unit}`
        : typeLabels[type.kind];
  return definition.isList ? `List: ${base.toLowerCase()}` : base;
}

function handTextOf(definition: PropertyDefinition): string {
  if (definition.handTier !== null) {
    return `By hand, tier ${definition.handTier}`;
  }

  return mayBeEnteredByHand(definition) ? "Not by hand" : "From the catalog";
}

type Editing = { kind: "new" } | { kind: "edit"; definition: PropertyDefinition };

// Each definition: its name and key, its type, what it is about, its visibility and how it is
// entered.
export const propertyColumns: ColumnDefinition<PropertyDefinition>[] = [
  {
    key: "property",
    header: "Property",
    track: "minmax(10rem,1.4fr)",
    cell: (definition) => (
      <>
        <strong className="block font-medium">{propertyNameOf(definition)}</strong>
        <span className="font-mono text-xs text-muted-foreground">{definition.key}</span>
      </>
    ),
  },
  {
    key: "type",
    header: "Type",
    track: "minmax(8rem,1fr)",
    cell: (definition) => typeTextOf(definition),
  },
  {
    key: "about",
    header: "About",
    track: "max-content",
    cell: (definition) => subjectLabels[definition.about],
  },
  {
    key: "visibility",
    header: "Visibility",
    track: "max-content",
    cell: (definition) => visibilityLabels[definition.visibility],
  },
  {
    key: "hand",
    header: "Entered",
    track: "max-content",
    cell: (definition) => handTextOf(definition),
  },
];

export function PropertiesPage() {
  const [params, setParams] = useSearchParams();
  const selectedKey = params.get(selectedParam);
  const select = (key: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (key === null) next.delete(selectedParam);
        else next.set(selectedParam, key);
        return next;
      },
      { replace: true },
    );
  const { data: session } = useSessionQuery();
  const { data: index, isLoading, isError, refetch } = usePropertiesQuery();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<PropertyDefinition | null>(null);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  const create = useActionMutation({
    call: createProperty,
    invalidates: propertyInvalidations,
    refusalTexts: propertyRefusalTexts,
  });
  const save = useActionMutation({
    call: saveProperty,
    invalidates: propertyInvalidations,
    refusalTexts: propertyRefusalTexts,
  });
  const remove = useActionMutation({
    call: deleteProperty,
    invalidates: propertyInvalidations,
    refusalTexts: { "property.predefined": "A predefined property is edited, never deleted." },
  });

  if (session === undefined) return null;
  const canDefine = hasPermission(session, "property.define");
  const definitions = index?.definitions ?? [];
  const selected = definitions.find((definition) => definition.key === selectedKey) ?? null;
  const valueCountOf = (key: string) => index?.valueCounts[key] ?? 0;

  const headerActions: ViewAction[] = canDefine
    ? [
        {
          id: "new",
          label: "New property…",
          isPrimary: true,
          onSelect: () => setEditing({ kind: "new" }),
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Properties" actions={headerActions} />
      {notice !== null && (
        <NoticeLine
          tone="green"
          title={notice.title}
          onDismiss={() => setNotice(null)}
          className="mx-4 mt-3"
        >
          {notice.detail}
        </NoticeLine>
      )}
      {isError && (
        <div role="alert" className="border-b px-4 py-3 text-sm text-destructive">
          Properties could not be loaded.{" "}
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      <MasterDetail
        master={
          <RecordList
            rows={definitions}
            rowId={(definition) => definition.key}
            total={index === undefined ? undefined : definitions.length}
            toolbar={{ count: plural(definitions.length, "property", "properties") }}
            columns={propertyColumns}
            card={{
              eyebrow: (definition) => definition.key,
              title: (definition) => propertyNameOf(definition),
              meta: (definition) => (
                <>
                  {typeTextOf(definition)} · {subjectLabels[definition.about]} ·{" "}
                  {visibilityLabels[definition.visibility]}
                </>
              ),
            }}
            whyOf={(definition) => (definition.isPredefined ? "Predefined" : null)}
            paging={localPaging}
            isLoading={isLoading}
            selectedId={selectedKey}
            onSelect={select}
            loadingText="Loading properties…"
            emptyText="No properties are defined."
            loadingMoreText="Loading more properties…"
          />
        }
        detail={
          <Pane
            state={paneStateOf(
              selectedKey,
              index === undefined ? undefined : selected,
              "This property no longer exists",
            )}
            emptyIcon={Tags}
            emptyText="Select a property"
            render={(definition) => (
              <PropertyDetail
                definition={definition}
                valueCount={valueCountOf(definition.key)}
                canDefine={canDefine}
                onEdit={() => setEditing({ kind: "edit", definition })}
                onDelete={() => setDeleting(definition)}
              />
            )}
          />
        }
        detailTitle={selected === null ? "Property" : propertyNameOf(selected)}
        detailOpen={selectedKey !== null}
        onDetailOpenChange={(open) => {
          if (!open) select(null);
        }}
      />
      {editing !== null && (
        <PropertyEditor
          key={editing.kind === "new" ? "new" : editing.definition.key}
          definition={editing.kind === "new" ? null : editing.definition}
          valueCount={editing.kind === "new" ? 0 : valueCountOf(editing.definition.key)}
          onClose={() => setEditing(null)}
          onSave={(property: NewProperty) =>
            editing.kind === "new" ? create.run(property) : save.run(property)
          }
          onSaved={(definition) => {
            setEditing(null);
            select(definition.key);
            setNotice({
              title: editing.kind === "new" ? "Property created" : "Property saved",
              detail:
                editing.kind === "new" && definition.handTier !== null
                  ? `Give ${editPermissionOf(definition.key)} on Users management to whoever enters it.`
                  : propertyNameOf(definition),
            });
          }}
        />
      )}
      {deleting !== null && (
        <DeletePropertyDialog
          definition={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await remove.run(deleting.key);
            if (result.isDone) {
              select(null);
              setNotice({
                title: "Property deleted",
                detail: `${propertyNameOf(deleting)} and its key are gone; the key is never used again.`,
              });
            }
            return result;
          }}
        />
      )}
    </>
  );
}

function PropertyDetail({
  definition,
  valueCount,
  canDefine,
  onEdit,
  onDelete,
}: {
  definition: PropertyDefinition;
  valueCount: number;
  canDefine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const actions: ViewAction[] = canDefine
    ? [
        { id: "edit", label: "Edit…", onSelect: onEdit },
        ...(definition.isPredefined
          ? []
          : [
              {
                id: "delete",
                label: "Delete…",
                isDestructive: true,
                isInMenu: true,
                onSelect: onDelete,
              },
            ]),
      ]
    : [];

  return (
    <article className="@container mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="hidden text-xl font-semibold break-words md:block">
            {propertyNameOf(definition)}
          </h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{definition.key}</p>
        </div>
        <ActionBar actions={actions} menuLabel="More" />
      </div>
      <DetailCard title="Definition">
        <FactGrid
          facts={[
            { label: "Name in English", value: definition.names.en },
            { label: "Name in Czech", value: definition.names.cs },
            { label: "About", value: subjectLabels[definition.about] },
            { label: "Type", value: typeTextOf(definition) },
            { label: "Visibility", value: visibilityLabels[definition.visibility] },
            { label: "Entered", value: handTextOf(definition) },
            {
              label: "Held by",
              value: plural(valueCount, definition.about === "document" ? "document" : "attempt"),
            },
            ...(definition.handTier === null
              ? []
              : [
                  {
                    label: "Permission",
                    value: (
                      <span className="font-mono text-xs">{editPermissionOf(definition.key)}</span>
                    ),
                  },
                ]),
          ]}
        />
        {definition.isPredefined && (
          <FinePrint>
            Predefined: counting, generating and the pages' filters read it, so it is edited but
            never deleted.
          </FinePrint>
        )}
      </DetailCard>
      {definition.type.kind === "enum" && (
        <DetailCard title={`Values · ${definition.type.values.length}`}>
          <ul className="divide-y">
            {definition.type.values.map((value) => (
              <li key={value.value} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <span className="font-medium">{value.names.en}</span>
                <span className="text-muted-foreground">{value.names.cs}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {value.value}
                </span>
              </li>
            ))}
          </ul>
        </DetailCard>
      )}
    </article>
  );
}

function DeletePropertyDialog({
  definition,
  onClose,
  onConfirm,
}: {
  definition: PropertyDefinition;
  onClose: () => void;
  onConfirm: () => Promise<ActionResult<void>>;
}) {
  const { data: impact } = useQuery({
    queryKey: ["properties", definition.key, "impact"],
    queryFn: () => fetchPropertyImpact(definition.key),
  });
  const consequences: Consequence[] | undefined =
    impact === undefined
      ? undefined
      : [
          {
            text:
              impact.valueCount === 0
                ? "No record holds a value of it."
                : `${plural(impact.valueCount, "record")} lose ${impact.valueCount === 1 ? "its value" : "their values"}.`,
            tone: impact.valueCount === 0 ? "plain" : "red",
          },
          ...(impact.roleNames.length === 0
            ? []
            : [
                {
                  text: `Its permission is taken from ${impact.roleNames.join(", ")}.`,
                },
              ]),
          ...impact.watchlists.map((watchlist) => ({
            text: watchlist.isShared
              ? `${watchlist.name} loses its condition on it and pauses until each recipient confirms.`
              : `${watchlist.name} loses its condition on it.`,
            tone: watchlist.isShared ? ("amber" as const) : ("plain" as const),
          })),
          ...impact.intentionNames.map((name) => ({
            text: `${name} loses its condition on it, and counts more from then on.`,
            tone: "amber" as const,
          })),
          { text: `The key ${definition.key} is never used again.` },
        ];

  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={`Delete ${propertyNameOf(definition)}?`}
      description="What deleting this property removes"
      consequences={consequences}
      confirmLabel="Delete property"
      isDestructive
      onConfirm={onConfirm}
    />
  );
}
