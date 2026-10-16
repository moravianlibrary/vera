// An intention's conditions on properties (PLAN-scope): read now for an item not yet digitized and
// on its digitized date for one that is, narrowing what it counts and what is generated for it,
// and gone with a deleted property (DOC-property-delete).

import type { Intention, Iteration } from "@vera/domain/entities";
import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { createIntention, previewIntention } from "@/mocks/intentions";
import { createProperty, deleteProperty, meetsScopeConditions } from "@/mocks/properties";
import { resolveSession } from "@/mocks/session";

const iteration = (id: string) =>
  database.iterations.find((candidate) => candidate.id === id) as Iteration;

const sized = (size: string): Pick<Intention, "scopeConditions"> => ({
  scopeConditions: [{ key: "size", anyOf: [size] }],
});

function setSizeLater(documentId: string, size: string): void {
  database.documents = database.documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          properties: [
            {
              key: "size",
              sources: [
                ...(document.properties.find((values) => values.key === "size")?.sources ?? []),
                {
                  source: { kind: "plugin", instanceId: "pi1", instanceName: "MZK Aleph" },
                  tier: 50,
                  value: size,
                  observedAt: "2026-07-01T09:00:00Z",
                  setBy: null,
                },
              ],
            },
          ],
        }
      : document,
  );
}

describe("scope conditions", () => {
  it("read a digitized item on its digitized date, and one not digitized now", () => {
    // D1's attempt IT1 was digitized on 19 June with size A2; D4's IT4 is still Ready.
    setSizeLater("D1", "A3");
    setSizeLater("D4", "A3");
    database.documents = database.documents.map((document) =>
      document.id === "D1" || document.id === "D4"
        ? {
            ...document,
            properties: document.properties.map((values) => ({
              ...values,
              sources: values.sources.map((source) =>
                source.source.kind === "plugin" ? { ...source, tier: 120 } : source,
              ),
            })),
          }
        : document,
    );
    expect(meetsScopeConditions(sized("A2"), iteration("IT1"))).toBe(true);
    expect(meetsScopeConditions(sized("A3"), iteration("IT1"))).toBe(false);
    expect(meetsScopeConditions(sized("A3"), iteration("IT4"))).toBe(true);
  });

  it("narrow what an intention counts", () => {
    const admin = resolveSession("admin");
    const request = {
      intentionId: null,
      funding: { kind: "any" as const },
      scopeCategoryId: null,
      countsFrom: "2026-01-01",
      endsOn: null,
      mix: { kind: "none" as const },
    };
    const all = previewIntention(admin, request);
    const zeutschel = previewIntention(admin, {
      ...request,
      scopeConditions: [{ key: "machines", anyOf: ["zeutschel"] }],
    });
    if (!("value" in all) || !("value" in zeutschel)) throw new Error("preview refused");
    expect(zeutschel.value.outputPages).toBeLessThan(all.value.outputPages);
    expect(zeutschel.value.outputPages).toBeGreaterThan(0);
  });

  it("must name a property, and go with a deleted one", () => {
    const admin = resolveSession("admin");
    const draft = {
      name: "Bound in leather",
      description: "",
      funding: { kind: "any" as const },
      scopeCategoryId: null,
      countsFrom: "2026-07-01",
      endsOn: null,
      targetPages: null,
      mix: { kind: "none" as const },
    };
    expect(
      createIntention(admin, { ...draft, scopeConditions: [{ key: "binding", anyOf: ["x"] }] }),
    ).toMatchObject({ refusal: { status: 422 } });
    createProperty(admin, "binding", {
      names: { en: "Binding", cs: "Vazba" },
      visibility: "staff",
      type: { kind: "text" },
      isList: false,
      about: "document",
      handTier: 100,
    });
    const created = createIntention(admin, {
      ...draft,
      scopeConditions: [{ key: "binding", contains: "leather" }],
    });
    if (!("value" in created)) throw new Error("not created");
    deleteProperty(admin, "binding");
    expect(
      database.intentions.find((intention) => intention.id === created.value.intention.id)
        ?.scopeConditions,
    ).toEqual([]);
  });
});
