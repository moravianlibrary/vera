// Set link… reads a PID or a viewer's address through the enabled Link instances, and a
// Publication detector sets the links it finds as its agent, logged as Set link… is (PLG-kinds).

import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { canonicalLinkOf, detectPublications, publicationDetectorAgentId } from "@/mocks/links";

const pid = "uuid:2a8c4f10-1b3e-11e4-8b9a-005056827e51";
const canonical = `https://www.digitalniknihovna.cz/mzk/uuid/${pid}`;

describe("canonicalLinkOf", () => {
  it("turns a PID and the viewer's own address into the canonical link (PLG-kinds)", () => {
    expect(canonicalLinkOf(pid)).toEqual({ url: canonical, instanceId: "pi32" });
    expect(
      canonicalLinkOf(`https://www.digitalniknihovna.cz/mzk/view/${pid}?page=uuid:0000`),
    ).toEqual({ url: canonical, instanceId: "pi32" });
  });

  it("keeps any other web address as typed, and reads nothing else", () => {
    expect(canonicalLinkOf("https://kramerius.mzk.cz/view/uuid:d12")).toEqual({
      url: "https://kramerius.mzk.cz/view/uuid:d12",
      instanceId: null,
    });
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

    database.iterations.splice(index, 1, { ...before, progress: "Digitized", links: [] });
    const found = detectPublications("pi33");
    const after = database.iterations.find((iteration) => iteration.id === "IT12");
    const entry = database.statusLog.findLast((logged) => logged.subjectId === "IT12");

    expect(found.map(({ id }) => id)).toContain("IT12");
    expect(after).toMatchObject({ progress: "Published" });
    expect(after?.links[0]?.url).toMatch(/^https:\/\/www\.digitalniknihovna\.cz\/mzk\/uuid\/uuid:/);
    expect(entry).toMatchObject({
      code: "iteration.published",
      actor: { kind: "user", userId: publicationDetectorAgentId },
    });
  });

  it("adds a detector's address beside a person's link, then adds nothing twice", () => {
    const previous = database.iterations;
    const iteration = previous.find((candidate) => candidate.id === "IT34");
    if (iteration === undefined) throw new Error("IT34 is in the fixtures");
    const personLinks = iteration.links.filter((link) => link.instanceId !== "pi33");
    database.iterations = [{ ...iteration, links: personLinks }];
    try {
      const first = detectPublications("pi33");
      const afterFirst = database.iterations[0];
      expect(first.map(({ id }) => id)).toEqual(["IT34"]);
      expect(afterFirst?.links).toHaveLength(personLinks.length + 1);
      expect(afterFirst?.links.at(-1)).toMatchObject({ instanceId: "pi33", isPrimary: false });
      expect(detectPublications("pi33")).toEqual([]);
    } finally {
      database.iterations = previous;
    }
  });
});
