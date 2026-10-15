// Set link… reads a PID or a viewer's address through the enabled Link instances, and a
// Publication detector sets the links it finds as its agent, logged as Set link… is (PLG-kinds).

import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { canonicalLinkOf, detectPublications, publicationDetectorAgentId } from "@/mocks/links";

const pid = "uuid:2a8c4f10-1b3e-11e4-8b9a-005056827e51";
const canonical = `https://www.digitalniknihovna.cz/mzk/uuid/${pid}`;

describe("canonicalLinkOf", () => {
  it("turns a PID and the viewer's own address into the canonical link (PLG-kinds)", () => {
    expect(canonicalLinkOf(pid)).toBe(canonical);
    expect(canonicalLinkOf(`https://www.digitalniknihovna.cz/mzk/view/${pid}?page=uuid:0000`)).toBe(
      canonical,
    );
  });

  it("keeps any other web address as typed, and reads nothing else", () => {
    expect(canonicalLinkOf("https://kramerius.mzk.cz/view/uuid:d12")).toBe(
      "https://kramerius.mzk.cz/view/uuid:d12",
    );
    expect(canonicalLinkOf("shelf 12")).toBeNull();
    expect(canonicalLinkOf("ftp://a.cz/x")).toBeNull();
  });

  it("takes no PID while no Link instance is enabled", () => {
    const instances = database.pluginInstances;
    database.pluginInstances = instances.map((instance) =>
      instance.id === "pi32" ? { ...instance, isEnabled: false } : instance,
    );
    try {
      expect(canonicalLinkOf(pid)).toBeNull();
    } finally {
      database.pluginInstances = instances;
    }
  });
});

describe("detectPublications", () => {
  it("sets the links of digitized items as its agent, logged as Published (ACT-publish)", () => {
    const index = database.iterations.findIndex((iteration) => iteration.id === "IT12");
    const before = database.iterations[index];
    if (before === undefined) {
      throw new Error("IT12 is in the fixtures");
    }

    database.iterations.splice(index, 1, { ...before, progress: "Digitized", publishedLink: null });
    const found = detectPublications();
    const after = database.iterations.find((iteration) => iteration.id === "IT12");
    const entry = database.statusLog.findLast((logged) => logged.subjectId === "IT12");

    expect(found.map(({ id }) => id)).toContain("IT12");
    expect(after).toMatchObject({ progress: "Published" });
    expect(after?.publishedLink).toMatch(/^https:\/\/www\.digitalniknihovna\.cz\/mzk\/uuid\/uuid:/);
    expect(entry).toMatchObject({
      event: "Published",
      actor: { kind: "user", userId: publicationDetectorAgentId },
    });
  });
});
