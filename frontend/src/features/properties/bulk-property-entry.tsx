// Entering one property's value on several documents at once, picked on Documents
// (DOC-property-hand): *Select* starts picking rows, and *Enter a property…* offers each property
// the person may enter by hand. The server enters it document by document and says which refused,
// as an attempt already scanned does.
// TODO(rrandiak): labels move to i18n.

import type { BulkPropertyEntryResult } from "@vera/contract/properties";
import type { Session } from "@vera/domain/entities";
import type { PropertyDefinition } from "@vera/domain/properties";
import { propertyNameOf } from "@vera/domain/properties";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { RowPicking } from "@/components/lists/record-list";
import { NoticeLine } from "@/components/notice-line";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canEnterProperty } from "@/features/properties/properties-card";
import { PropertyValueDialog } from "@/features/properties/property-value-dialog";
import { usePropertiesQuery } from "@/features/properties/use-properties-query";
import { plural } from "@/lib/plural";

export interface BulkPropertyEntryState {
  // Undefined when the person may enter no property by hand.
  readonly picking: RowPicking | undefined;
  readonly toolbarActions: ReactNode;
  readonly notice: ReactNode;
  readonly dialog: ReactNode;
}

export function useBulkPropertyEntry(
  session: Session | undefined,
  isStaff: boolean,
): BulkPropertyEntryState {
  const { data: index } = usePropertiesQuery();
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string> | null>(null);
  const [entering, setEntering] = useState<PropertyDefinition | null>(null);
  const [result, setResult] = useState<{
    definition: PropertyDefinition;
    entered: BulkPropertyEntryResult;
  } | null>(null);
  const enterable =
    isStaff && session !== undefined
      ? (index?.definitions ?? []).filter((definition) => canEnterProperty(session, definition))
      : [];

  if (enterable.length === 0) {
    return { picking: undefined, toolbarActions: null, notice: null, dialog: null };
  }

  const isPicking = pickedIds !== null;
  const picked = pickedIds ?? new Set<string>();
  const picking: RowPicking | undefined = isPicking
    ? {
        pickedIds: picked,
        onToggle: (id) =>
          setPickedIds((current) => {
            const next = new Set(current ?? []);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
      }
    : undefined;

  const toolbarActions = isPicking ? (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">
        {plural(picked.size, "picked", "picked")}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7" disabled={picked.size === 0}>
            Enter a property…
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {enterable.map((definition) => (
            <DropdownMenuItem key={definition.key} onSelect={() => setEntering(definition)}>
              {propertyNameOf(definition)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setPickedIds(null)}>
        Done
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="ghost" className="h-7" onClick={() => setPickedIds(new Set())}>
      Select
    </Button>
  );

  const notice =
    result === null ? null : (
      <NoticeLine
        tone={result.entered.refusals.length === 0 ? "green" : "amber"}
        title={`${propertyNameOf(result.definition)} entered for ${plural(result.entered.enteredCount, "document")}`}
        onDismiss={() => setResult(null)}
        className="mx-4 mt-3"
      >
        {result.entered.refusals.length === 0
          ? "Every picked document took it."
          : `${plural(result.entered.refusals.length, "document")} refused: ${result.entered.refusals
              .map((refusal) => refusal.message)
              .filter((message, at, all) => all.indexOf(message) === at)
              .join("; ")}.`}
      </NoticeLine>
    );

  const dialog =
    entering === null ? null : (
      <PropertyValueDialog
        definition={entering}
        documentIds={[...picked]}
        isBulk
        handValue={null}
        onClose={() => setEntering(null)}
        onEntered={(entered) => {
          setEntering(null);
          if ("enteredCount" in entered) {
            setResult({ definition: entering, entered });
          }
          setPickedIds(null);
        }}
      />
    );

  return { picking, toolbarActions, notice, dialog };
}
