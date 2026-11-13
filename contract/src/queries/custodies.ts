// Shared read queries for Users & Groups custody projections.

import type { CustodyRecord } from "@vera/domain/access";
import type { RecordStore } from "@vera/domain/store";
import type { CustodyImpact } from "../access";
import type { RequestPlugins } from "./requests";
import { openProposalPlacements, openProposalRows } from "./requests";

export interface CustodyRule {
  instanceId: string;
  custodyId: string;
}

export function openProposalCountsByCustody(
  store: RecordStore,
  plugins: RequestPlugins,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const custodyId of openProposalPlacements(store, plugins).flat()) {
    counts.set(custodyId, (counts.get(custodyId) ?? 0) + 1);
  }
  return counts;
}

export function custodyRecordOf(
  custody: {
    id: string;
    name: string;
    names: { cs?: string; en?: string };
    description: string;
    isFallback: boolean;
    memberIds: readonly string[];
    groupIds: readonly string[];
  },
  counts: ReadonlyMap<string, number>,
  rules: readonly CustodyRule[],
): CustodyRecord {
  return {
    ...custody,
    memberIds: [...custody.memberIds],
    groupIds: [...custody.groupIds],
    openCount: counts.get(custody.id) ?? 0,
    placedByIds: custody.isFallback
      ? []
      : rules.filter((rule) => rule.custodyId === custody.id).map(({ instanceId }) => instanceId),
  };
}

export function accessProposalsOf(store: RecordStore, plugins: RequestPlugins) {
  return openProposalRows(store, plugins).map((row) => ({
    id: row.record.document.id,
    title: row.record.document.title,
    custodyIds: row.custodyIds,
  }));
}

// What deleting the custody does: its open proposals are placed again, and those it alone held
// land in the fallback.
export function custodyImpactOf(
  store: RecordStore,
  plugins: RequestPlugins,
  custodyId: string,
  rules: readonly CustodyRule[],
): CustodyImpact {
  const placements = openProposalPlacements(store, plugins).filter((placed) =>
    placed.includes(custodyId),
  );
  return {
    openCount: placements.length,
    toFallbackCount: placements.filter((placed) => placed.length === 1).length,
    ruleIds: rules
      .filter((rule) => rule.custodyId === custodyId)
      .map(({ instanceId }) => instanceId),
  };
}
