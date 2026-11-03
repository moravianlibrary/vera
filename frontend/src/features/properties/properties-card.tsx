// A record's properties on its pane (DOC-property-filter): every property the person may read
// that the catalog record does not already show, the document's and the current attempt's, each
// with its value in use and every source under it, its tier, when it was observed and who set it
// (DOC-property-values). A public reader sees the public ones only, without who set them
// (DOC-property-visibility). Staff with `property.<key>.edit` enter a value here
// (DOC-property-hand).

import type { Audience, DocumentRecord } from "@vera/domain/documents";
import { currentIterationOf } from "@vera/domain/documents";
import type { Session } from "@vera/domain/entities";
import { can } from "@vera/domain/permissions";
import type { PropertyDefinition, PropertyValues, SourcedValue } from "@vera/domain/properties";
import {
  editPermissionOf,
  formatPropertyValue,
  mayBeEnteredByHand,
  propertyNameOf,
  sourcesByTierOf,
  valueInUseOf,
  valuesOf,
} from "@vera/domain/properties";
import { isFoundAfterScan } from "@vera/domain/validations";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DetailCard, DetailRow, FinePrint, Muted } from "@/components/detail-card";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { PropertyValueDialog } from "@/features/properties/property-value-dialog";
import { usePropertiesQuery } from "@/features/properties/use-properties-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { i18n } from "@/i18n";
import { formatLongDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";

// Whether the person may enter it here: defined for hand entry, not a catalog fact, and the
// permission at `any` (PERM-property-edit). The page count has its own act (ACT-page-count).
export function canEnterProperty(session: Session, definition: PropertyDefinition): boolean {
  return (
    definition.handTier !== null &&
    !definition.isCatalogFact &&
    mayBeEnteredByHand(definition) &&
    can(session, editPermissionOf(definition.key), { kind: "unscoped" })
  );
}

// The properties the pages' own cards do not show: the predefined four are the catalog's.
export function shownDefinitionsOf(
  definitions: readonly PropertyDefinition[],
  audience: Audience,
): PropertyDefinition[] {
  return definitions.filter(
    (definition) =>
      !definition.isPredefined && (audience === "staff" || definition.visibility === "public"),
  );
}

function sourceNameOf(source: SourcedValue["source"]): string {
  return source.kind === "hand" ? i18n.t("properties:propertiesCard.byHand") : source.instanceName;
}

interface PropertiesCardProps {
  record: DocumentRecord;
  audience: Audience;
  nameOf: (userId: string) => string;
}

export function PropertiesCard({ record, audience, nameOf }: PropertiesCardProps) {
  const { t } = useTranslation("properties");
  const { data: session } = useSessionQuery();
  const { data: index } = usePropertiesQuery();
  const [entering, setEntering] = useState<PropertyDefinition | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = currentIterationOf(record);
  const shown = shownDefinitionsOf(index?.definitions ?? [], audience);
  const documentDefinitions = shown.filter((definition) => definition.about === "document");
  const attemptDefinitions =
    current === null ? [] : shown.filter((definition) => definition.about === "attempt");
  if (
    session === undefined ||
    (documentDefinitions.length === 0 && attemptDefinitions.length === 0)
  ) {
    return null;
  }

  const isStaff = audience === "staff";
  const isScanned = current !== null && isFoundAfterScan(current);
  const valuesFor = (definition: PropertyDefinition) =>
    valuesOf(
      definition.about === "document" ? record.document.properties : (current?.properties ?? []),
      definition.key,
    );
  const enterable = (definition: PropertyDefinition) =>
    isStaff &&
    canEnterProperty(session, definition) &&
    (definition.about === "document" || !isScanned);
  // One hand value per property, whoever entered it.
  const handValueOf = (values: PropertyValues | undefined) =>
    values?.sources.find((source) => source.source.kind === "hand")?.value ?? null;

  const rows = (definitions: readonly PropertyDefinition[]) =>
    definitions.map((definition) => (
      <PropertyRow
        key={definition.key}
        definition={definition}
        values={valuesFor(definition)}
        isStaff={isStaff}
        nameOf={nameOf}
        onEnter={enterable(definition) ? () => setEntering(definition) : undefined}
      />
    ));

  return (
    <DetailCard title={t("propertiesCard.title")}>
      {notice !== null && <p className="mb-2 text-xs text-tone-green-foreground">{notice}</p>}
      {rows(documentDefinitions)}
      {attemptDefinitions.length > 0 && (
        <>
          <h3 className="mt-3.5 mb-1 text-xs font-semibold text-muted-foreground">
            {t("propertiesCard.thisAttempt")}
          </h3>
          {rows(attemptDefinitions)}
          {isStaff && isScanned && <FinePrint>{t("propertiesCard.scanned")}</FinePrint>}
        </>
      )}
      {entering !== null && (
        <PropertyValueDialog
          definition={entering}
          documentIds={[record.document.id]}
          handValue={handValueOf(valuesFor(entering))}
          onClose={() => setEntering(null)}
          onEntered={(result) => {
            setEntering(null);
            setNotice(
              i18n.t(
                "properties:propertiesCard.entered" +
                  ("isRechecked" in result && result.isRechecked ? "Rechecked" : ""),
                { name: propertyNameOf(entering) },
              ),
            );
          }}
        />
      )}
    </DetailCard>
  );
}

function PropertyRow({
  definition,
  values,
  isStaff,
  nameOf,
  onEnter,
}: {
  definition: PropertyDefinition;
  values: PropertyValues | undefined;
  isStaff: boolean;
  nameOf: (userId: string) => string;
  onEnter: (() => void) | undefined;
}) {
  const { t } = useTranslation("properties");
  const inUse = valueInUseOf(values);
  const sources = sourcesByTierOf(values);
  return (
    <div className="border-b py-1.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          {propertyNameOf(definition)}
          {": "}
          <b className="font-semibold">
            {inUse === null ? (
              <Muted>{t("propertiesCard.noValue")}</Muted>
            ) : (
              formatPropertyValue(definition, inUse.value)
            )}
          </b>
        </span>
        {onEnter !== undefined && (
          <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={onEnter}>
            {inUse === null ? t("propertiesCard.enter") : t("propertiesCard.change")}
          </Button>
        )}
      </div>
      {isStaff &&
        sources.map((source) => (
          <DetailRow
            key={`${source.source.kind}-${source.source.kind === "plugin" ? source.source.instanceId : source.setBy}`}
            aside={
              source === inUse && sources.length > 1 ? (
                <ToneBadge tone="green">{t("propertiesCard.inUse")}</ToneBadge>
              ) : undefined
            }
          >
            <span className="text-xs">
              {formatPropertyValue(definition, source.value)}{" "}
              <Muted>
                {joinDetails([
                  sourceNameOf(source.source),
                  t("propertiesCard.tier", { count: source.tier }),
                  formatLongDay(source.observedAt),
                  source.setBy === null ? null : nameOf(source.setBy),
                ])}
              </Muted>
            </span>
          </DetailRow>
        ))}
    </div>
  );
}
