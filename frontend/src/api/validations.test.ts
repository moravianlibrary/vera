// Documents Validations end to end against the mock server over HTTP: whose iterations each
// curator reviews (category custody), what the filters and facets read, the verdicts and what each
// refuses, and the fixes in place and Cancel that the pane offers beside them. Verdicts change the
// mock's state, so each test rules on its own iterations.

import type { ValidationQuery } from "@vera/contract/validations";
import {
  isSameValidationQuery,
  parseValidationSearchParams,
  toValidationSearchParams,
} from "@vera/contract/validations";
import { outstandingDefects } from "@vera/domain/status";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { cancelIteration, enterPageCount, recheckIteration } from "@/api/iterations";
import {
  acceptDefects,
  denyDefects,
  findValidation,
  listValidations,
  revokeAcceptance,
} from "@/api/validations";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";
import { eventEntry } from "./event-entries-test";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function statusOf(call: Promise<unknown>): Promise<number | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}

async function idsOf(query: ValidationQuery): Promise<string[]> {
  const page = await listValidations(query);
  return page.items.map((row) => row.iteration.id);
}

describe("listValidations", () => {
  it("keeps a curator to the categories in their custody", async () => {
    signInAs("curator");

    const ids = await idsOf({});

    expect(ids).toEqual(expect.arrayContaining(["IT13", "IT16", "IT11", "IT3", "IT14"]));
    expect(ids).not.toContain("IT10"); // 20th-century monographs are not hers
    expect(ids).not.toContain("IT12"); // nor early modern manuscripts
  });

  it("shows an admin every category", async () => {
    signInAs("admin");

    const ids = await idsOf({});

    expect(ids).toEqual(expect.arrayContaining(["IT10", "IT12", "IT6"]));
  });

  it("puts what needs review first, the most urgent before the rest", async () => {
    signInAs("curator");

    const page = await listValidations({});
    const reviews = page.items.map((row) => row.review);

    expect(reviews.indexOf("Needed")).toBe(0);
    expect(reviews.lastIndexOf("Needed")).toBeLessThan(reviews.indexOf("Denied"));
    expect(page.items[0]?.iteration.priority).toBe("Urgent");
  });

  it("files a forbidden item apart from review, whatever its defects", async () => {
    signInAs("curator");

    const page = await listValidations({ forbidden: ["Yes"] });

    expect(page.items.map((row) => row.iteration.id)).toEqual(["IT14"]);
    expect(page.facets.reviews).toEqual([]); // a forbidden item has no review state
    expect(await idsOf({ reviews: ["Needed"] })).not.toContain("IT14");
    expect(await idsOf({ forbidden: ["No"] })).not.toContain("IT14");
  });

  it("filters to rows with defects to rule on from the selected instance", async () => {
    signInAs("curator");

    const page = await listValidations({ reviews: ["Needed"], instances: ["pi9"] });

    expect(page.items.length).toBeGreaterThan(0);
    expect(
      page.items.every((row) =>
        outstandingDefects(row.iteration).some((defect) => defect.instanceId === "pi9"),
      ),
    ).toBe(true);
    const ids = page.items.map((row) => row.iteration.id);
    expect(ids).toContain("IT16");
    expect(ids).toContain("IT18"); // its page count was accepted; 260$c remains outstanding
  });

  it("matches a category's whole subtree and counts the outstanding defects", async () => {
    signInAs("curator");

    const page = await listValidations({ categoryIds: ["c2"], reviews: ["Needed"] });

    expect(page.total).toBe(page.items.length);
    expect(page.outstandingTotal).toBeGreaterThanOrEqual(page.total);
    expect(
      page.items.every((row) => ["c21", "c22", "c23"].includes(row.iteration.categoryId)),
    ).toBe(true);
  });

  it("lets a digitization curator review the categories in their custody", async () => {
    signInAs("digitization");

    expect(await statusOf(listValidations({}))).toBeNull();
  });
});

describe("findValidation", () => {
  it("returns the iteration with its history, and nothing outside custody", async () => {
    signInAs("curator");

    const detail = await findValidation("IT11");
    const outside = await findValidation("IT10");

    expect(detail?.row.review).toBe("Denied");
    expect(eventEntry(detail?.log[0]).code).toBe("iteration.verdict_denied");
    expect(outside).toBeNull();
  });
});

describe("verdicts", () => {
  it("accepts the outstanding set, and every gate passing makes it Ready", async () => {
    signInAs("curator");

    const result = await acceptDefects("IT16", {
      defectKeys: ["pi9:R03:pages"],
      note: "An estimate is enough here.",
    });
    const detail = await findValidation("IT16");

    expect(result.review).toBe("Approved");
    expect(result.progress).toBe("Ready");
    expect(eventEntry(detail?.log[0]).code).toBe("iteration.verdict_accepted");
  });

  it("refuses a set that changed meanwhile, a forbidden item and one outside custody", async () => {
    signInAs("curator");

    expect(
      await statusOf(acceptDefects("IT19", { defectKeys: ["pi9:R01:pages"], note: null })),
    ).toBe(409);
    expect(
      await statusOf(acceptDefects("IT14", { defectKeys: ["pi10:R01:041$a"], note: null })),
    ).toBe(409);
    expect(
      await statusOf(acceptDefects("IT10", { defectKeys: ["pi9:R03:245$a"], note: null })),
    ).toBe(404);
  });

  it("denies the defects picked, with what every asker reads", async () => {
    signInAs("curator");

    const result = await denyDefects("IT13", {
      defectKeys: ["pi9:R07:260$c"],
      publicText: "The publication years are unclear on the record.",
      internalText: null,
    });
    const detail = await findValidation("IT13");
    const verdict = detail?.row.iteration.verdicts.at(-1);

    expect(result.review).toBe("Denied");
    expect(result.askerCount).toBeGreaterThan(0);
    expect(verdict?.defectKeys).toEqual(["pi9:R07:260$c"]);
    expect(verdict?.publicText).toBe("The publication years are unclear on the record.");
  });

  it("revokes an acceptance: the defect is outstanding again and Ready is undone", async () => {
    signInAs("curator");

    const result = await revokeAcceptance("IT3", { defectKeys: ["pi9:R02:pages"] });

    expect(result.review).toBe("Needed");
    expect(result.progress).toBe("Enqueued"); // a gate fails after Ready (V14)
    expect(await statusOf(revokeAcceptance("IT3", { defectKeys: ["pi9:R02:pages"] }))).toBe(409); // nothing is accepted now
  });
});

describe("grouping", () => {
  it("groups by each defect instance and files rows with multiple instances under several", async () => {
    signInAs("admin");

    const page = await listValidations({}, { grouping: "defect" });
    const expectedInstances = new Set(
      page.items.flatMap((row) => {
        if (row.review === "Forbidden" || row.review === "Approved") return [];
        const instances = new Set(
          (row.review === "Needed" ? outstandingDefects(row.iteration) : row.iteration.defects).map(
            (defect) => defect.instanceId,
          ),
        );
        const instanceId = instances.values().next().value as string | undefined;
        return instanceId === undefined ? [] : [instances.size === 1 ? instanceId : "several"];
      }),
    );
    const groupInstances = new Set(
      page.groups.flatMap((group) =>
        group.kind === "defect" && group.instanceId !== null ? [group.instanceId] : [],
      ),
    );

    expect(groupInstances).toEqual(expectedInstances);
    expect(
      page.items.some((row) => {
        const instances = new Set(
          (row.review === "Needed" ? outstandingDefects(row.iteration) : row.iteration.defects).map(
            (defect) => defect.instanceId,
          ),
        );
        return row.review !== "Forbidden" && row.review !== "Approved" && instances.size > 1;
      }),
    ).toBe(true);
    expect(
      page.groups.some((group) => group.kind === "defect" && group.instanceId === "several"),
    ).toBe(true);
  });

  it("files each row in one defect group, several instances apart and forbidden last", async () => {
    signInAs("admin");

    const page = await listValidations({}, { grouping: "defect" });
    const plugins = page.groups.map((group) => (group.kind === "defect" ? group.instanceId : "?"));

    expect(plugins.at(-1)).toBeNull(); // nothing left to rule on: forbidden or accepted
    expect(plugins).toContain("several");
    expect(new Set(plugins).size).toBe(plugins.length); // a group never comes back
    const instanceGroups = plugins.filter(
      (value): value is string => value !== null && value !== "several",
    );
    for (const instanceId of instanceGroups) {
      expect(
        page.items.some((row) => {
          const instances = new Set(
            outstandingDefects(row.iteration).map((defect) => defect.instanceId),
          );
          return instances.size === 1 && instances.has(instanceId);
        }),
      ).toBe(true);
    }
    expect(
      page.items.some(
        (row) =>
          new Set(outstandingDefects(row.iteration).map((defect) => defect.instanceId)).size > 1,
      ),
    ).toBe(true);
    expect(page.groups.reduce((sum, group) => sum + group.rowCount, 0)).toBe(page.items.length);
    const accepted = page.items.filter((row) => row.review === "Approved").length;
    expect(page.groups.at(-1)?.rowCount).toBeGreaterThanOrEqual(accepted);
  });

  it("groups by category in the tree's order and counts each over the whole filter", async () => {
    signInAs("admin");

    const page = await listValidations({}, { grouping: "category" });

    expect(page.groups.reduce((sum, group) => sum + group.total, 0)).toBe(page.total);
  });
});

describe("page count and recheck", () => {
  it("clears a page-count defect once someone counts the pages, so no verdict is needed", async () => {
    signInAs("curator");

    const result = await enterPageCount("IT11", { pages: 312 });

    expect(result.clearedKeys).toEqual(["pi9:R01:pages"]);
    expect(result.review).toBeNull(); // the denial lapsed with its defect
    expect(result.progress).toBe("Ready");
    expect(await findValidation("IT11")).toBeNull();
  });

  it("clears what was repaired in the catalog and finds the rest again", async () => {
    signInAs("admin");

    const result = await recheckIteration("IT10");

    expect(result.clearedKeys).toEqual(["pi9:R03:245$a"]);
    expect(result.review).toBe("Needed"); // 041$a is still missing in the catalog
  });

  it("finds the same defects when nothing was repaired", async () => {
    signInAs("admin");

    const result = await recheckIteration("IT19");

    expect(result.clearedKeys).toEqual([]);
    expect(result.review).toBe("Needed");
  });

  it("runs after the scan too, and never moves progress back", async () => {
    signInAs("admin");

    const result = await recheckIteration("IT12");

    expect(result.clearedKeys).toEqual(["pi9:R11:300$a"]);
    expect(result.progress).toBe("Digitized");
  });

  it("refuses a page count once scanned, where the scan counts the pages", async () => {
    signInAs("admin");

    expect(await statusOf(enterPageCount("IT12", { pages: 18 }))).toBe(409);
  });

  it("answers a refusal as Problem Details with its own code", async () => {
    signInAs("admin");

    const error = await enterPageCount("IT12", { pages: 18 }).catch((caught: unknown) => caught);

    expect(error instanceof ApiError && error.problem).toMatchObject({
      status: 409,
      code: "iteration.scanned",
      type: "https://vera.mzk.cz/problems/iteration.scanned",
    });
  });

  it("names the field a rejected body got wrong", async () => {
    signInAs("admin");

    const error = await enterPageCount("IT11", { pages: -3 }).catch((caught: unknown) => caught);

    expect(error instanceof ApiError && error.problem).toMatchObject({
      status: 422,
      code: "invalid",
      errors: [{ field: "pages" }],
    });
  });
});

describe("cancel", () => {
  it("takes it off its list and out of review, back to what its gates say (C3)", async () => {
    signInAs("curator");

    const result = await cancelIteration("IT25", {
      publicText: "Postponed — will be scheduled next quarter.",
      internalText: null,
    });

    // Planned on L-2026-015, but a page-count defect holds it: off the list it is Enqueued.
    expect(result.progress).toBe("Enqueued");
    expect(await findValidation("IT25")).toBeNull();
    expect(
      await statusOf(cancelIteration("IT25", { publicText: "Again.", internalText: null })),
    ).toBe(409);
  });
});

describe("the query in the URL", () => {
  it("round-trips, whatever order the values come in", () => {
    const query: ValidationQuery = {
      search: "velehrad",
      reviews: ["Needed", "Denied"],
      instances: ["pi9"],
      waiting: { from: "2026-06-01" },
    };

    const parsed = parseValidationSearchParams(toValidationSearchParams(query));

    expect(isSameValidationQuery(parsed, { ...query, reviews: ["Denied", "Needed"] })).toBe(true);
    expect(toValidationSearchParams(query).get("since")).toBe("2026-06-01..");
  });
});
