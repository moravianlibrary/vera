// Shape: Master–detail.
// Properties, under Administration (UI-pages): every property definition (DOC-property), each
// opening in its pane, for a holder of `property.define`. The predefined four are edited, never
// deleted (DOC-property-predefined); deleting another first says, from the server, what goes with
// it (DOC-property-delete). The open property lives at ?property=.

import { useQuery } from "@tanstack/react-query";
import type { NewProperty } from "@vera/contract/properties";
import { hasPermission } from "@vera/domain/permissions";
import type { PropertyDefinition } from "@vera/domain/properties";
import { editPermissionOf, mayBeEnteredByHand, propertyNameOf } from "@vera/domain/properties";
import { Tags } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
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
import { failureOf } from "@/components/query-state";
import {
  PropertyEditor,
  propertyRefusalTextsOf,
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
import { i18n } from "@/i18n";

const selectedParam = "property";
const localPaging = { hasMore: false, isLoadingMore: false, onLoadMore: () => {} };

// "One of a set of values · 5", "List of numbers in cm".
export function typeTextOf(definition: PropertyDefinition): string {
  const { type } = definition;
  const base =
    type.kind === "enum"
      ? `${i18n.t(typeLabels.enum)} · ${type.values.length}`
      : type.kind === "number" && type.unit !== ""
        ? `${i18n.t(typeLabels.number)} in ${type.unit}`
        : i18n.t(typeLabels[type.kind]);
  return definition.isList
    ? i18n.t("properties:propertiesPage.listType", { type: base.toLowerCase() })
    : base;
}

function handTextOf(definition: PropertyDefinition): string {
  if (definition.handTier !== null) {
    return i18n.t("properties:propertiesPage.byHandTier", { count: definition.handTier });
  }

  return mayBeEnteredByHand(definition)
    ? i18n.t("properties:propertiesPage.notByHand")
    : i18n.t("properties:propertiesPage.fromCatalog");
}

type Editing = { kind: "new" } | { kind: "edit"; definition: PropertyDefinition };

// Each definition: its name and key, its type, what it is about, its visibility and how it is
// entered.
export const propertyColumns: ColumnDefinition<PropertyDefinition>[] = [
  {
    key: "property",
    header: "properties:propertiesPage.property",
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
    header: "properties:propertiesPage.type",
    track: "minmax(8rem,1fr)",
    cell: (definition) => typeTextOf(definition),
  },
  {
    key: "about",
    header: "properties:propertiesPage.about",
    track: "max-content",
    cell: (definition) => i18n.t(subjectLabels[definition.about]),
  },
  {
    key: "visibility",
    header: "properties:propertiesPage.visibility",
    track: "max-content",
    cell: (definition) => i18n.t(visibilityLabels[definition.visibility]),
  },
  {
    key: "hand",
    header: "properties:propertiesPage.entered",
    track: "max-content",
    cell: (definition) => handTextOf(definition),
  },
];

export function PropertiesPage() {
  const { t } = useTranslation("properties");
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
    refusalTexts: propertyRefusalTextsOf(t),
  });
  const save = useActionMutation({
    call: saveProperty,
    invalidates: propertyInvalidations,
    refusalTexts: propertyRefusalTextsOf(t),
  });
  const remove = useActionMutation({
    call: deleteProperty,
    invalidates: propertyInvalidations,
    refusalTexts: { "property.predefined": t("propertiesPage.predefinedRefusal") },
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
          label: t("propertiesPage.new"),
          isPrimary: true,
          onSelect: () => setEditing({ kind: "new" }),
        },
      ]
    : [];

  return (
    <>
      <PageHeader title={t("propertiesPage.title")} actions={headerActions} />
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
      <MasterDetail
        master={
          <RecordList
            rows={definitions}
            rowId={(definition) => definition.key}
            total={index === undefined ? undefined : definitions.length}
            toolbar={{ count: t("propertiesPage.count", { count: definitions.length }) }}
            columns={propertyColumns}
            card={{
              eyebrow: (definition) => definition.key,
              title: (definition) => propertyNameOf(definition),
              meta: (definition) => (
                <>
                  {typeTextOf(definition)} · {i18n.t(subjectLabels[definition.about])} ·{" "}
                  {i18n.t(visibilityLabels[definition.visibility])}
                </>
              ),
            }}
            whyOf={(definition) =>
              definition.isPredefined ? "properties:propertiesPage.predefined" : null
            }
            paging={localPaging}
            isLoading={isLoading}
            selectedId={selectedKey}
            onSelect={select}
            loadingText={t("propertiesPage.loading")}
            emptyText={t("propertiesPage.empty")}
            failure={failureOf({ isError, refetch }, t("propertiesPage.loadError"))}
            loadingMoreText={t("propertiesPage.loadingMore")}
          />
        }
        detail={
          <Pane
            state={paneStateOf(
              selectedKey,
              index === undefined ? undefined : selected,
              t("propertiesPage.gone"),
            )}
            emptyIcon={Tags}
            emptyText={t("propertiesPage.select")}
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
        detailTitle={selected === null ? t("propertiesPage.property") : propertyNameOf(selected)}
        detailOpen={selectedKey !== null}
        onDetailOpenChange={(open) => {
          if (!open) select(null);
        }}
        swipe={{
          items: definitions,
          idOf: (definition) => definition.key,
          labelOf: propertyNameOf,
          currentId: selectedKey,
          onSelect: (key) => select(key),
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
              title: t(editing.kind === "new" ? "propertiesPage.created" : "propertiesPage.saved"),
              detail:
                editing.kind === "new" && definition.handTier !== null
                  ? t("propertiesPage.givePermission", {
                      permission: editPermissionOf(definition.key),
                    })
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
                title: t("propertiesPage.deleted"),
                detail: t("propertiesPage.deleteNotice", { name: propertyNameOf(deleting) }),
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
  const { t } = useTranslation("properties");
  const actions: ViewAction[] = canDefine
    ? [
        { id: "edit", label: t("propertiesPage.edit"), onSelect: onEdit },
        ...(definition.isPredefined
          ? []
          : [
              {
                id: "delete",
                label: t("propertiesPage.delete"),
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
        <ActionBar actions={actions} menuLabel={t("propertiesPage.more")} />
      </div>
      <DetailCard title={t("propertiesPage.definition")}>
        <FactGrid
          facts={[
            { label: t("propertiesPage.nameEnglish"), value: definition.names.en },
            { label: t("propertiesPage.nameCzech"), value: definition.names.cs },
            { label: t("propertiesPage.about"), value: i18n.t(subjectLabels[definition.about]) },
            { label: t("propertiesPage.type"), value: typeTextOf(definition) },
            {
              label: t("propertiesPage.visibility"),
              value: i18n.t(visibilityLabels[definition.visibility]),
            },
            { label: t("propertiesPage.entered"), value: handTextOf(definition) },
            {
              label: t("propertiesPage.heldBy"),
              value: t(
                definition.about === "document"
                  ? "propertiesPage.valueCountDocument"
                  : "propertiesPage.valueCountAttempt",
                { count: valueCount },
              ),
            },
            ...(definition.handTier === null
              ? []
              : [
                  {
                    label: t("propertiesPage.permission"),
                    value: (
                      <span className="font-mono text-xs">{editPermissionOf(definition.key)}</span>
                    ),
                  },
                ]),
          ]}
        />
        {definition.isPredefined && <FinePrint>{t("propertiesPage.predefinedNote")}</FinePrint>}
      </DetailCard>
      {definition.type.kind === "enum" && (
        <DetailCard
          title={t("propertiesPage.valuesCount", { count: definition.type.values.length })}
        >
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
  const { t } = useTranslation("properties");
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
                ? t("propertiesPage.noValuesHeld")
                : t("propertiesPage.valuesRemoved", { count: impact.valueCount }),
            tone: impact.valueCount === 0 ? "plain" : "red",
          },
          ...(impact.roleNames.length === 0
            ? []
            : [
                {
                  text: t("propertiesPage.permissionRemoved", {
                    names: impact.roleNames.join(", "),
                  }),
                },
              ]),
          ...impact.watchlists.map((watchlist) => ({
            text: watchlist.isShared
              ? t("propertiesPage.sharedWatchlistConditionRemoved", { name: watchlist.name })
              : t("propertiesPage.watchlistConditionRemoved", { name: watchlist.name }),
            tone: watchlist.isShared ? ("amber" as const) : ("plain" as const),
          })),
          ...impact.intentionNames.map((name) => ({
            text: t("propertiesPage.intentionConditionRemoved", { name }),
            tone: "amber" as const,
          })),
          { text: t("propertiesPage.keyRetired", { key: definition.key }) },
        ];

  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={t("propertiesPage.deleteTitle", { name: propertyNameOf(definition) })}
      description={t("propertiesPage.deleteDescription")}
      consequences={consequences}
      confirmLabel={t("propertiesPage.deleteProperty")}
      isDestructive
      onConfirm={onConfirm}
    />
  );
}
