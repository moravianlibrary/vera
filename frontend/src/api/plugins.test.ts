// Plugins end to end against the mock server over HTTP: who reads the page, what an instance
// carries (never its secrets), and making, editing, switching off, running and deleting one, with
// what each takes out of the rest of VERA; then uploading a package, installing it and moving an
// instance to it. The acts change the mock's state, so each block reads what the one before left.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { listGenerators } from "@/api/lists";
import type { PluginIndex } from "@/api/plugins";
import {
  createPluginInstance,
  deletePluginInstance,
  disablePluginInstance,
  enablePluginInstance,
  getInstanceUpgrade,
  getPluginImpact,
  getPluginIndex,
  installPluginUpload,
  runPluginInstance,
  savePluginInstance,
  upgradePluginInstance,
  uploadPluginPackage,
} from "@/api/plugins";
import { listPluginInstances } from "@/api/reference";
import { listSchedules } from "@/api/schedules";
import { listRuns } from "@/api/tasks";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function refusalOf(
  call: Promise<unknown>,
): Promise<{ status: number; code?: string } | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? { status: error.status, code: error.problem?.code } : null;
  }
}

const instanceOf = (index: PluginIndex, instanceId: string) =>
  index.instances.find((instance) => instance.id === instanceId);

const packageNamed = (name: string) => new File(["PK"], name, { type: "application/java-archive" });

describe("getPluginIndex", () => {
  it("is plugin.read's", async () => {
    signInAs("curator");

    expect(await refusalOf(getPluginIndex())).toMatchObject({ status: 403 });
  });

  it("lists the implementations in kind order, each with its versions", async () => {
    signInAs("admin");
    const { implementations } = await getPluginIndex();

    expect(implementations.slice(0, 3).map((implementation) => implementation.name)).toEqual([
      "AlephCatalogAdapter",
      "KrameriusRegistry",
      "RDCZRegistry",
    ]);
    expect(implementations.find((implementation) => implementation.id === "pt3")).toMatchObject({
      kind: "Registry",
      versions: [
        {
          version: "1.2.3",
          declares: {
            rawStates: expect.arrayContaining([
              { raw: "Revision", state: null, isExistingCopy: false },
            ]),
          },
        },
      ],
    });
  });

  it("never sends a secret back, only that it is set", async () => {
    signInAs("admin");
    const slack = instanceOf(await getPluginIndex(), "pi18");

    expect(slack?.configuration).toEqual({ workspace: "mzk", bot: "vera" });
    expect(slack?.secretsSet).toEqual(["token"]);
  });

  it("gives an instance its schedules, its recent runs and its last run", async () => {
    signInAs("admin");
    const kramerius = instanceOf(await getPluginIndex(), "pi4");

    expect(kramerius?.schedules).toEqual([expect.objectContaining({ id: "s2", isPaused: false })]);
    expect(kramerius?.recentRuns[0]).toMatchObject({ id: "T-9916", state: "Running" });
    expect(kramerius?.lastRunAt).toBe(kramerius?.recentRuns[0]?.startedAt);
    expect(instanceOf(await getPluginIndex(), "pi22")?.settings).toMatchObject({
      kind: "Identity",
      label: "Log in with MZK account",
      mappings: expect.arrayContaining([{ claim: "group mzk-staff", roleId: "staff" }]),
    });
  });
});

describe("an instance", () => {
  const configuration = { base_url: "aleph.mzk.cz", protocol: "REST", timeout: "30s" };

  it("is made with every field its version requires", async () => {
    signInAs("admin");
    const draft = {
      implementationId: "pt1",
      name: "SVKOS Aleph",
      configuration: { base_url: "aleph.svkos.cz" },
      linkedCategoryId: null,
      settings: null,
    };

    expect(await refusalOf(createPluginInstance(draft))).toMatchObject({
      status: 422,
      code: "plugin.config_missing",
    });
    const made = await createPluginInstance({
      ...draft,
      configuration: { ...configuration, base_url: "aleph.svkos.cz" },
    });
    expect(made).toMatchObject({
      name: "SVKOS Aleph",
      version: "2.4.1",
      isEnabled: true,
      triggers: ["OnProposal", "OnIngest", "OnDemand"],
    });
    expect((await listPluginInstances()).some((instance) => instance.id === made.id)).toBe(true);
    expect(
      await refusalOf(createPluginInstance({ ...draft, name: "mzk aleph", configuration })),
    ).toMatchObject({ status: 409, code: "plugin.name_taken" });
  });

  it("is only configure's to make", async () => {
    signInAs("curator");

    expect(
      await refusalOf(
        createPluginInstance({
          implementationId: "pt1",
          name: "Elsewhere",
          configuration,
          linkedCategoryId: null,
          settings: null,
        }),
      ),
    ).toMatchObject({ status: 403 });
  });

  it("keeps a secret that is not sent again", async () => {
    signInAs("admin");
    const saved = await savePluginInstance("pi18", {
      name: "MZK Slack bot",
      configuration: { workspace: "mzk", bot: "vera-bot" },
      linkedCategoryId: null,
      settings: null,
    });

    expect(saved).toMatchObject({ name: "MZK Slack bot", secretsSet: ["token"] });
    expect(saved.configuration).toEqual({ workspace: "mzk", bot: "vera-bot" });
  });

  it("takes the settings of its kind, and keeps an identity's user id claim once people use it", async () => {
    signInAs("admin");
    const keycloak = instanceOf(await getPluginIndex(), "pi22");
    const draft = {
      name: "MZK Keycloak",
      configuration: { issuer: "sso.mzk.cz/realms/mzk", client: "vera" },
      linkedCategoryId: null,
      settings: keycloak?.settings ?? null,
    };

    expect(await refusalOf(savePluginInstance("pi22", { ...draft, settings: null }))).toMatchObject(
      { status: 422, code: "plugin.settings" },
    );
    if (keycloak?.settings?.kind !== "Identity") {
      throw new Error("MZK Keycloak has identity settings");
    }

    expect(
      await refusalOf(
        savePluginInstance("pi22", {
          ...draft,
          settings: { ...keycloak.settings, userIdClaim: "email" },
        }),
      ),
    ).toMatchObject({ status: 409, code: "plugin.user_claim_fixed" });
    const saved = await savePluginInstance("pi22", {
      ...draft,
      settings: { ...keycloak.settings, defaultRoleId: "reader" },
    });
    expect(saved.settings).toMatchObject({ defaultRoleId: "reader" });
  });
});

describe("switching an instance off", () => {
  it("says what stops first", async () => {
    signInAs("admin");

    expect(await getPluginImpact("pi14")).toMatchObject({
      kind: "ListGenerator",
      otherEnabledCount: 1,
    });
    expect(await getPluginImpact("pi23")).toMatchObject({ kind: "Identity", userCount: 1 });
    expect((await getPluginImpact("pi25")).openProposalCount).toBeGreaterThan(0);
    expect(await getPluginImpact("pi1")).toMatchObject({ scheduleCount: 1, runCount: 2 });
  });

  it("takes a list generator out of Generate until it is enabled again", async () => {
    signInAs("admin");
    await disablePluginInstance("pi15");

    expect((await listGenerators()).map((generator) => generator.id)).toEqual(["pi14"]);
    expect(await refusalOf(disablePluginInstance("pi15"))).toMatchObject({ status: 409 });
    await enablePluginInstance("pi15");
    expect((await listGenerators()).map((generator) => generator.id)).toEqual(["pi14", "pi15"]);
  });

  it("never switches off the last way to log in", async () => {
    signInAs("admin");
    await disablePluginInstance("pi23");
    await disablePluginInstance("pi24");

    expect(await refusalOf(disablePluginInstance("pi22"))).toMatchObject({
      status: 409,
      code: "plugin.last_identity",
    });
    expect(await refusalOf(deletePluginInstance("pi22"))).toMatchObject({ status: 409 });
    await enablePluginInstance("pi23");
    await enablePluginInstance("pi24");
  });
});

describe("running and deleting an instance", () => {
  it("runs a kind that runs by itself, as a run on Tasks", async () => {
    signInAs("admin");
    const run = await runPluginInstance("pi9");

    expect(run).toMatchObject({
      what: "Default ruleset — run by hand",
      state: "Running",
      trigger: { kind: "manual", from: { label: "Plugins" } },
    });
    expect(await refusalOf(runPluginInstance("pi14"))).toMatchObject({
      status: 422,
      code: "plugin.not_runnable",
    });
  });

  it("is plugin.run's to run", async () => {
    signInAs("curator");

    expect(await refusalOf(runPluginInstance("pi9"))).toMatchObject({ status: 403 });
  });

  it("deletes its schedules with it and keeps its runs", async () => {
    signInAs("admin");
    await deletePluginInstance("pi3");

    expect(instanceOf(await getPluginIndex(), "pi3")).toBeUndefined();
    expect((await listSchedules("day")).schedules.some((row) => row.id === "s7")).toBe(false);
    expect((await listPluginInstances()).some((instance) => instance.id === "pi3")).toBe(false);
    expect(await refusalOf(getPluginImpact("pi3"))).toMatchObject({ status: 404 });
    const runs = await listRuns({ instanceIds: ["pi1"] });
    expect(runs.finished[0]?.source).toMatchObject({
      kind: "plugin",
      instance: { name: "MZK Aleph" },
    });
  });
});

describe("uploading a package", () => {
  it("is upload_code's", async () => {
    signInAs("curator");

    expect(
      await refusalOf(uploadPluginPackage(packageNamed("catalog-validity-3.2.0.jar"), "pt6")),
    ).toMatchObject({ status: 403 });
  });

  it("reads only a package with a descriptor", async () => {
    signInAs("admin");

    expect(await refusalOf(uploadPluginPackage(packageNamed("notes.txt"), null))).toMatchObject({
      status: 422,
      code: "plugin.not_a_package",
    });
    expect(
      await refusalOf(uploadPluginPackage(packageNamed("something-else-1.0.0.jar"), null)),
    ).toMatchObject({ status: 422, code: "plugin.no_descriptor" });
    expect(
      await refusalOf(uploadPluginPackage(packageNamed("kramerius-registry-1.9.0.jar"), "pt6")),
    ).toMatchObject({ status: 422, code: "plugin.other_implementation" });
    expect(
      await refusalOf(uploadPluginPackage(packageNamed("catalog-validity-3.1.0.jar"), "pt6")),
    ).toMatchObject({ status: 409, code: "plugin.version_installed" });
  });

  it("says what a new version adds and retires, installs it, and moves an instance only when asked", async () => {
    signInAs("admin");
    const reading = await uploadPluginPackage(packageNamed("catalog-validity-3.2.0.jar"), "pt6");

    expect(reading).toMatchObject({
      name: "CatalogValidity",
      implementationId: "pt6",
      currentVersion: "3.1.0",
      isRunnable: true,
      difference: {
        added: [{ kind: "rule", name: "R12", label: "shelf mark present" }],
        retired: [{ kind: "rule", name: "R11", label: "extent matches what was delivered" }],
      },
    });
    const installed = await installPluginUpload(reading.id);
    expect(installed.versions.map((version) => version.version)).toEqual(["3.2.0", "3.1.0"]);
    expect(instanceOf(await getPluginIndex(), "pi9")?.version).toBe("3.1.0");

    expect(await getInstanceUpgrade("pi9")).toMatchObject({
      fromVersion: "3.1.0",
      toVersion: "3.2.0",
    });
    expect((await upgradePluginInstance("pi9")).version).toBe("3.2.0");
    expect(await refusalOf(getInstanceUpgrade("pi9"))).toMatchObject({
      status: 409,
      code: "plugin.up_to_date",
    });
  });

  it("installs a new implementation, and one for another contract is never run", async () => {
    signInAs("admin");
    const harvester = await installPluginUpload(
      (await uploadPluginPackage(packageNamed("oai-pmh-harvester-0.1.0.jar"), null)).id,
    );

    expect(harvester).toMatchObject({ name: "OaiPmhHarvester", kind: "Harvester" });
    const reading = await uploadPluginPackage(packageNamed("kramerius7-registry-2.0.0.jar"), null);
    expect(reading).toMatchObject({ isRunnable: false, implementationId: null });
    const registry = await installPluginUpload(reading.id);
    expect(
      await refusalOf(
        createPluginInstance({
          implementationId: registry.id,
          name: "MZK Kramerius 7",
          configuration: { base_url: "k7.mzk.cz", link: "content" },
          linkedCategoryId: null,
          settings: null,
        }),
      ),
    ).toMatchObject({ status: 404 });
  });
});
