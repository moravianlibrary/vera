// What a new version declares beside an older one (plugins.md §2.5–§2.6): names added and retired
// by their kind, config fields added and dropped, versions compared by number, and which contract
// versions VERA runs; and an instance's policy, its defaults, and carried to another version
// (PLG-upgrade).

import { describe, expect, it } from "vitest";
import type { Declarations } from "@/domain/plugins";
import {
  compareVersions,
  declarationDifferenceOf,
  defaultPolicyOf,
  isRunnableContract,
  isUnchanged,
  policyForVersion,
  policyMismatchOf,
} from "@/domain/plugins";

const none: Declarations = {
  properties: [],
  identifierTypes: [],
  rawStates: [],
  rules: [],
  agent: null,
  generatorClass: null,
  channelInterface: null,
  inputMode: null,
  loginEntry: null,
};

const field = (key: string) => ({ key, isSecret: false, isRequired: true });

describe("compareVersions", () => {
  it("compares by number, not by text", () => {
    expect(compareVersions("2.10.0", "2.4.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.9.2", "1.0.0")).toBeLessThan(0);
  });
});

describe("isRunnableContract", () => {
  it("runs any version built against the same major contract", () => {
    expect(isRunnableContract("1.3")).toBe(true);
    expect(isRunnableContract("2.0")).toBe(false);
  });
});

describe("declarationDifferenceOf", () => {
  it("names what was added and retired, each by its kind", () => {
    const from = {
      declares: { ...none, rules: [{ code: "R11", label: "extent" }], identifierTypes: ["ISSN"] },
      configFields: [field("severity"), field("rules")],
    };
    const to = {
      declares: {
        ...none,
        rules: [{ code: "R12", label: "shelf mark" }],
        identifierTypes: ["ISSN"],
        properties: [{ key: "page_count", tier: 50 }],
      },
      configFields: [field("severity"), field("strict")],
    };

    expect(declarationDifferenceOf(from, to)).toEqual({
      added: [
        { kind: "rule", name: "R12", label: "shelf mark" },
        { kind: "property", name: "page_count", label: null },
      ],
      retired: [{ kind: "rule", name: "R11", label: "extent" }],
      configAdded: ["strict"],
      configDropped: ["rules"],
    });
  });

  it("tells a rule code from a raw state of the same name", () => {
    const from = {
      declares: { ...none, rules: [{ code: "Planned", label: "" }] },
      configFields: [],
    };
    const to = {
      declares: { ...none, rawStates: [{ raw: "Planned", state: null, isExistingCopy: false }] },
      configFields: [],
    };

    expect(declarationDifferenceOf(from, to).retired).toHaveLength(1);
    expect(isUnchanged(declarationDifferenceOf(from, from))).toBe(true);
  });
});

describe("an instance's policy (PLG-upgrade)", () => {
  const declares: Declarations = {
    ...none,
    properties: [
      { key: "page_count", tier: 50 },
      { key: "material_type", tier: 50 },
    ],
    rawStates: [
      { raw: "Digitized", state: "Digitized", isExistingCopy: true },
      { raw: "Revision", state: null, isExistingCopy: false },
    ],
  };

  it("defaults to what the version declares", () => {
    expect(defaultPolicyOf(declares)).toEqual({
      tiers: [
        { key: "page_count", tier: 50 },
        { key: "material_type", tier: 50 },
      ],
      copyStates: ["Digitized"],
      agent: null,
    });
  });

  it("keeps its choices on another version, defaults what is new and drops what is retired", () => {
    const own = {
      tiers: [
        { key: "page_count", tier: 70 },
        { key: "material_type", tier: 20 },
      ],
      copyStates: ["Digitized", "Revision"],
      agent: null,
    };
    const next: Declarations = {
      ...declares,
      properties: [
        { key: "page_count", tier: 50 },
        { key: "units", tier: 40 },
      ],
      rawStates: [
        { raw: "Revision", state: null, isExistingCopy: false },
        { raw: "Published", state: "Published", isExistingCopy: true },
      ],
    };

    expect(policyForVersion(own, next)).toEqual({
      tiers: [
        { key: "page_count", tier: 70 },
        { key: "units", tier: 40 },
      ],
      copyStates: ["Revision", "Published"],
      agent: null,
    });
  });

  it("says why a policy does not fit its version", () => {
    const fits = defaultPolicyOf(declares);

    expect(policyMismatchOf(fits, declares)).toBeNull();
    expect(policyMismatchOf({ ...fits, tiers: [] }, declares)).toMatch(/tier/);
    expect(policyMismatchOf({ ...fits, copyStates: ["Lost"] }, declares)).toMatch(/registry/);
    expect(
      policyMismatchOf({ ...fits, agent: { name: "Sweep", entryPoint: "additions" } }, declares),
    ).toMatch(/no agent/);
  });
});
