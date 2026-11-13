import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import {
  archiveIntention,
  createIntention,
  createIntentionTemplate,
  deleteIntention,
  listIntentionIndex,
} from "@/api/intentions";
import {
  archiveMix,
  createMix,
  deleteMix,
  getMix,
  listMixes,
  makePrimaryMix,
  saveMixSetById,
  snapshotMix,
} from "@/api/mix-catalog";
import { findIntentionMix } from "@/api/mixes";
import { i18n } from "@/i18n";
import { createHandlers } from "@/mocks/handlers";

it("reads and writes mix names in both languages", async () => {
  server.use(...createHandlers("admin"));
  const created = await createMix({
    names: { en: "Winter allocation", cs: "Zimní příděl" },
    fromMixId: null,
    fromRevision: null,
  });
  expect(created.names).toEqual({ en: "Winter allocation", cs: "Zimní příděl" });
  await i18n.changeLanguage("cs");
  try {
    expect((await getMix(created.id)).name).toBe("Zimní příděl");
  } finally {
    await i18n.changeLanguage("en");
  }
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function statusOf(call: Promise<unknown>) {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}

it("creates independent revisions, labels a snapshot, changes Primary, and preserves active followers at archive", async () => {
  server.use(...createHandlers("admin"));
  const copy = await createMix({
    names: { en: `Autumn allocation ${crypto.randomUUID()}` },
    fromMixId: "d2",
    fromRevision: 2,
  });
  expect(copy.revision).toBe(1);
  expect(copy.shares.c2).toBe(70);
  const changed = await saveMixSetById(copy.id, {
    parentId: null,
    revision: 1,
    shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
  });
  expect(changed.revision).toBe(2);
  expect(changed.revisions.find((version) => version.revision === 1)?.shares.c2).toBe(70);
  expect(
    await statusOf(
      saveMixSetById(copy.id, {
        parentId: null,
        revision: 1,
        shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
      }),
    ),
  ).toBe(409);
  const named = await snapshotMix(copy.id, { revision: 1, label: "Approved autumn" });
  expect(named.revisions.find((version) => version.revision === 1)?.label).toBe("Approved autumn");

  const intention = await createIntention({
    name: `Autumn target ${crypto.randomUUID()}`,
    description: "",
    funding: { kind: "any" },
    scopeCategoryId: null,
    countsFrom: "2026-07-01",
    endsOn: "2026-12-31",
    targetPages: 1000,
    mix: { kind: "use", mixId: copy.id, revision: null },
  });
  expect(intention.mix?.revision).toBe(2);
  await makePrimaryMix(copy.id);
  expect((await listMixes()).filter((mix) => mix.isPrimary).map((mix) => mix.id)).toEqual([
    copy.id,
  ]);
  const defaulted = await createIntention({
    name: `Defaulted ${crypto.randomUUID()}`,
    description: "",
    funding: { kind: "any" },
    scopeCategoryId: null,
    countsFrom: "2026-07-01",
    endsOn: null,
    targetPages: null,
    mix: { kind: "primary" },
  });
  expect(defaulted.intention.distributionId).toBe(copy.id);
  expect(
    (await listIntentionIndex()).rows.find((row) => row.intention.isOverall)?.intention
      .distributionId,
  ).toBe("d1");
  expect(await statusOf(archiveMix(copy.id))).toBe(409);
  await makePrimaryMix("d1");
  await archiveMix(copy.id);
  const pinned = (await listIntentionIndex()).rows.find(
    (row) => row.intention.id === intention.intention.id,
  );
  expect(pinned?.intention.mixRevision).toBe(2);
  expect((await getMix(copy.id)).archivedAt).not.toBeNull();
  expect(
    await statusOf(
      saveMixSetById(copy.id, {
        parentId: null,
        revision: 2,
        shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
      }),
    ),
  ).toBe(409);
});

it("preserves an archived intention's results when its shared mix changes", async () => {
  server.use(...createHandlers("admin"));
  const mix = await createMix({
    names: { en: `Archive test ${crypto.randomUUID()}` },
    fromMixId: "d1",
    fromRevision: null,
  });
  const intention = await createIntention({
    name: `Preserve ${crypto.randomUUID()}`,
    description: "",
    funding: { kind: "any" },
    scopeCategoryId: null,
    countsFrom: "2026-01-01",
    endsOn: "2026-12-31",
    targetPages: null,
    mix: { kind: "use", mixId: mix.id, revision: null },
  });
  const archived = await archiveIntention(intention.intention.id);
  const capturedTree = await findIntentionMix(intention.intention.id);
  await saveMixSetById(mix.id, {
    parentId: null,
    revision: 1,
    shares: { c1: 30, c2: 50, c3: 15, c4: 5 },
  });
  const reread = (await listIntentionIndex()).rows.find(
    (row) => row.intention.id === intention.intention.id,
  );
  expect(reread).toEqual(archived);
  expect(reread?.intention.mixRevision).toBe(1);
  expect((await findIntentionMix(intention.intention.id))?.mix).toEqual(capturedTree?.mix);
});

it("allows a repeat with no target and no mix", async () => {
  server.use(...createHandlers("admin"));
  const template = await createIntentionTemplate({
    description: "",
    namePatterns: { en: `Count ${crypto.randomUUID()} — {period}` },
    every: "month",
    funding: { kind: "any" },
    scopeCategoryId: null,
    mix: { kind: "none" },
    targetPages: null,
    isArchivingPrevious: true,
  });
  expect(template.template.distributionId).toBeNull();
  expect(template.template.targetPages).toBeNull();
});

it("PLAN-mix-remove: deletes only a mix never used, even after intention deletion", async () => {
  server.use(...createHandlers("admin"));
  const unused = await createMix({
    names: { en: `Unused ${crypto.randomUUID()}` },
    fromMixId: null,
    fromRevision: null,
  });
  expect(unused.everUsed).toBe(false);
  await deleteMix(unused.id);
  expect(await statusOf(getMix(unused.id))).toBe(404);

  const used = await createMix({
    names: { en: `Used ${crypto.randomUUID()}` },
    fromMixId: null,
    fromRevision: null,
  });
  const intention = await createIntention({
    name: `Use mix ${crypto.randomUUID()}`,
    description: "",
    funding: { kind: "any" },
    scopeCategoryId: null,
    countsFrom: "2026-07-01",
    endsOn: null,
    targetPages: null,
    mix: { kind: "use", mixId: used.id, revision: null },
  });
  expect((await getMix(used.id)).everUsed).toBe(true);
  expect(await statusOf(deleteMix(used.id))).toBe(409);
  await deleteIntention(intention.intention.id);
  expect((await getMix(used.id)).usageCount).toBe(0);
  expect(await statusOf(deleteMix(used.id))).toBe(409);
});
