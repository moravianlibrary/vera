import type { StatusLogEntry } from "@vera/domain/entities";
import type { EventEntry } from "@vera/domain/events";

export function eventEntry(entry: StatusLogEntry | undefined): EventEntry {
  if (entry === undefined) throw new Error("Expected an event history entry");
  return entry;
}

export function eventEntries(entries: readonly StatusLogEntry[]): EventEntry[] {
  return [...entries];
}
