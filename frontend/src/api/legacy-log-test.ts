import { isLegacyEntry, type LegacyLogEntry, type StatusLogEntry } from "@vera/domain/entities";
import type { EventEntry } from "@vera/domain/events";

export function legacyEntry(entry: StatusLogEntry | undefined): LegacyLogEntry {
  if (entry === undefined || !isLegacyEntry(entry))
    throw new Error("Expected a legacy history entry");
  return entry;
}

export function legacyEntries(entries: readonly StatusLogEntry[]): LegacyLogEntry[] {
  return entries.map((entry) => legacyEntry(entry));
}

export function eventEntry(entry: StatusLogEntry | undefined): EventEntry {
  if (entry === undefined || isLegacyEntry(entry))
    throw new Error("Expected an event history entry");
  return entry;
}

export function eventEntries(entries: readonly StatusLogEntry[]): EventEntry[] {
  return entries.filter((entry): entry is EventEntry => !isLegacyEntry(entry));
}
