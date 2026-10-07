// Proposal custodies and where the Custody plugins placed each open proposal, after
// docs/demos/shared/vera-data.js (proposal-custody.md). Members come directly or through a
// group. A placement is the plugins' last answer, by custody name; a proposal not listed here is
// placed by `houseRuleOf`, the mock's stand-in for the jq rule.

import type { Document, ProposalCustody, Request } from "@/domain/entities";

export interface StoredProposalCustody extends ProposalCustody {
  readonly memberIds: readonly string[];
  readonly groupIds: readonly string[];
}

export const proposalCustodies: readonly StoredProposalCustody[] = [
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

// The Custody instances and the custody names their rule can return (proposal-custody.md §3),
// which the custody's record names as what places proposals in it.
export const custodyRules = [
  {
    instanceId: "pi25",
    name: "House rules",
    names: ["Periodicals", "19th-century prints", "Moravica"],
  },
] as const;

export const custodyPlacements: Readonly<Record<string, readonly string[]>> = {
  R16: ["Periodicals", "19th-century prints"],
  R17: ["Periodicals", "19th-century prints"],
  R18: ["Periodicals", "19th-century prints"],
  R19: ["Periodicals"],
  R20: ["Moravica"],
  R28: ["Periodicals", "19th-century prints"],
  R29: ["Periodicals", "19th-century prints"],
  R30: ["Periodicals", "19th-century prints"],
  R31: ["Periodicals", "19th-century prints"],
  R32: ["Periodicals", "19th-century prints"],
  R33: ["Periodicals"],
  R34: ["Periodicals"],
  R35: [],
  R36: ["Periodicals"],
  R37: ["Periodicals"],
};

// What the house rule answers for a proposal made since: serials by material type, and the
// Moravica project's proposals.
export function houseRuleOf(request: Request, document: Document): string[] {
  return [
    ...(document.type === "Periodical" ? ["Periodicals"] : []),
    ...(request.projectId === "p3" ? ["Moravica"] : []),
  ];
}
