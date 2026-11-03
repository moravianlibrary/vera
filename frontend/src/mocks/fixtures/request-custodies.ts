// Request custodies and where the Custody plugins placed each open proposal, after
// docs/demos/shared/vera-data.js (proposal-custody.md). Members come directly or through a
// group. A placement is the plugins' last answer, by the custody each matching rule picked; a
// proposal not listed here is placed by `houseRuleOf`, the mock's stand-in for the jq rules.

import type { Document, Request } from "@vera/domain/entities";
import type { StoredRequestCustody } from "@vera/domain/request-custody";

export type { StoredRequestCustody };

export const requestCustodies: readonly StoredRequestCustody[] = [
  {
    id: "pc0",
    name: "Fallback",
    description: "What no Custody rule placed.",
    isFallback: true,
    memberIds: ["u3"],
    groupIds: [],
  },
  {
    id: "pc1",
    name: "Periodicals",
    description: "Serials and newspapers, by material type.",
    isFallback: false,
    memberIds: ["u8"],
    groupIds: ["g1"],
  },
  {
    id: "pc2",
    name: "19th-century prints",
    description: "Anything published 1800–1899, from field 260.",
    isFallback: false,
    memberIds: ["u1"],
    groupIds: [],
  },
  {
    id: "pc3",
    name: "Moravica",
    description: "Proposals into the Moravica project.",
    isFallback: false,
    memberIds: ["u2"],
    groupIds: ["g2"],
  },
];

export const custodyPlacements: Readonly<Record<string, readonly string[]>> = {
  R16: ["pc1", "pc2"],
  R17: ["pc1", "pc2"],
  R18: ["pc1", "pc2"],
  R19: ["pc1"],
  R20: ["pc3"],
  R28: ["pc1", "pc2"],
  R29: ["pc1", "pc2"],
  R30: ["pc1", "pc2"],
  R31: ["pc1", "pc2"],
  R32: ["pc1", "pc2"],
  R33: ["pc1"],
  R34: ["pc1"],
  R35: [],
  R36: ["pc1"],
  R37: ["pc1"],
};

// The custodies whose rules match a proposal made since: serials by material type, and the
// Moravica project's proposals.
export function houseRuleOf(request: Request, document: Document): string[] {
  return [
    ...(document.type === "Periodical" ? ["pc1"] : []),
    ...(request.projectId === "p3" ? ["pc3"] : []),
  ];
}
