// Plugins end to end against the mock server over HTTP: who reads the page, what an instance
// carries (never its secrets), and making, editing, switching off, running and deleting one, with
// what each takes out of the rest of VERA; then uploading a package, installing it and moving an
// instance to it. The acts change the mock's state, so each block reads what the one before left.

import type { PluginIndex } from "@vera/contract/plugins";
import { pluginKinds } from "@vera/domain/plugins";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { listGenerators } from "@/api/lists";
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
import { i18n } from "@/i18n";
import { historicalRuns } from "@/mocks/fixtures/tasks";
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

  it("lists the implementations in kind order, each with its versions (PLG-kinds)", async () => {
    signInAs("admin");
    const { implementations } = await getPluginIndex();

    const catalogNames = [
      "LocalAccounts",
      "OidcIdentity",
      "BarcodeReader",
      "CoverRecognition",
      "ShelfMarkRecognition",
      "CatalogCardRecognition",
      "EntryLink",
      "Pattern",
      "DnntoFromCatalog",
      "DnntoFromSdnnt",
      "PeriodicalGaps",
      "SftpFile",
      "GoogleSheet",
      "AlephOaiCatalogAdapter",
      "XmlDumpCatalogAdapter",
      "MarcExtentPageCount",
      "SiblingVolumePageCount",
      "PageCountPredictor",
      "ShelfMarkToSize",
      "JqProperty",
      "KrameriusRegistry",
      "RdczRegistry",
      "MarcComparator",
      "FieldsCompleteness",
      "ForbiddenByRecordValue",
      "JqCustody",
      "MaterialType",
      "PlaceOfPublication",
      "PriorityThenMix",
      "ShelfAdvisor",
      "KrameriusLink",
      "Kramerius72XPublicationDetector",
      "MailtoMessage",
      "SlackMessage",
      "SlackBotMessage",
      "HttpWebhook",
      "SlackNotifier",
      "SftpDrop",
      "SmtpMailer",
      "GmailAccountMailer",
    ];
    const keptNames: string[] = [];
    expect(
      implementations.every(({ name }) => [...catalogNames, ...keptNames].includes(name)),
    ).toBe(true);

    // PLG-kinds: the order a document meets them.
    const ranks = implementations.map((implementation) => pluginKinds.indexOf(implementation.kind));
    expect(ranks).toEqual(ranks.toSorted((first, second) => first - second));
    expect(implementations[0]?.kind).toBe("Identity");
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

  it("resolves a Czech instance name and round-trips both names", async () => {
    signInAs("admin");
    await i18n.changeLanguage("cs");
    try {
      expect(instanceOf(await getPluginIndex(), "pi36")).toMatchObject({
        name: "ID katalogového záznamu",
        names: { cs: "ID katalogového záznamu", en: "Catalog ID" },
      });
      const created = await createPluginInstance({
        implementationId: "pt1",
        names: { cs: "Katalog MZK", en: "MZK catalog" },
        configuration,
        linkedCategoryId: null,
        settings: null,
      });
      expect(created).toMatchObject({
        name: "Katalog MZK",
        names: { cs: "Katalog MZK", en: "MZK catalog" },
      });
      const saved = await savePluginInstance(created.id, {
        names: { cs: "Katalog MZK nový", en: "MZK catalog" },
        configuration,
        linkedCategoryId: null,
        settings: null,
      });
      expect(saved.names).toEqual({ cs: "Katalog MZK nový", en: "MZK catalog" });
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("enforces uniqueness separately within each language", async () => {
    signInAs("admin");
    const first = await createPluginInstance({
      implementationId: "pt1",
      names: { cs: "Místní Aleph", en: "Local Aleph" },
      configuration,
      linkedCategoryId: null,
      settings: null,
    });
    try {
      expect(
        await refusalOf(
          createPluginInstance({
            implementationId: "pt1",
            names: { cs: "Jiný Aleph", en: "Local Aleph" },
            configuration,
            linkedCategoryId: null,
            settings: null,
          }),
        ),
      ).toMatchObject({ status: 409, code: "plugin.name_taken" });
      expect(
        await refusalOf(
          createPluginInstance({
            implementationId: "pt1",
            names: { cs: "Místní Aleph", en: "Another Aleph" },
            configuration,
            linkedCategoryId: null,
            settings: null,
          }),
        ),
      ).toMatchObject({ status: 409, code: "plugin.name_taken" });
      const crossLanguage = await createPluginInstance({
        implementationId: "pt1",
        names: { cs: "Local Aleph", en: "Aleph elsewhere" },
        configuration,
        linkedCategoryId: null,
        settings: null,
      });
      expect(crossLanguage.names.cs).toBe("Local Aleph");
      await deletePluginInstance(crossLanguage.id);
    } finally {
      await deletePluginInstance(first.id);
    }
  });

  it("is made with every field its version requires", async () => {
    signInAs("admin");
    const draft = {
      implementationId: "pt1",
      names: { en: "SVKOS Aleph", cs: "SVKOS Aleph" },
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
      await refusalOf(
        createPluginInstance({
          ...draft,
          names: { en: "mzk aleph", cs: "mzk aleph" },
          configuration,
        }),
      ),
    ).toMatchObject({ status: 409, code: "plugin.name_taken" });
  });

  it("is only configure's to make", async () => {
    signInAs("curator");

    expect(
      await refusalOf(
        createPluginInstance({
          implementationId: "pt1",
          names: { en: "Elsewhere", cs: "Elsewhere" },
          configuration,
          linkedCategoryId: null,
          settings: null,
        }),
      ),
    ).toMatchObject({ status: 403 });
  });

  it("binds a custody rule to one custody, never the fallback (ACCESS-custody-by-plugins)", async () => {
    signInAs("admin");
    const draft = (custodyId: string) => ({
      names: { en: "Moravica project", cs: "Projekt Moravica" },
      configuration: { expr: '.request.project == "Moravica"' },
      linkedCategoryId: null,
      settings: { kind: "Custody" as const, custodyId },
    });

    expect(await refusalOf(savePluginInstance("pi35", draft("pc0")))).toMatchObject({
      status: 422,
      code: "plugin.no_such_custody",
    });
    expect(await refusalOf(savePluginInstance("pi35", draft("pc9")))).toMatchObject({
      code: "plugin.no_such_custody",
    });
    expect((await savePluginInstance("pi35", draft("pc1"))).settings).toEqual({
      kind: "Custody",
      custodyId: "pc1",
    });
    await savePluginInstance("pi35", draft("pc3"));
  });

  // PLG-bases: the kinds that read records keep their bases, each once; others keep none.
  it("keeps catalog bases on the kinds that read records", async () => {
    signInAs("admin");
    const copyright = instanceOf(await getPluginIndex(), "pi28");
    const draft = {
      names: copyright?.names ?? { en: "Czech copyright" },
      configuration: copyright?.configuration ?? {},
      linkedCategoryId: null,
      settings: null,
    };
    const saved = await savePluginInstance("pi28", { ...draft, catalogBases: ["MZK01", "MZK01"] });
    expect(saved.catalogBases).toEqual(["MZK01"]);
    expect((await savePluginInstance("pi28", draft)).catalogBases).toEqual(["MZK01"]);

    const slack = await savePluginInstance("pi18", {
      names: { en: "MZK Slack bot", cs: "MZK Slack bot" },
      configuration: { workspace: "mzk", bot: "vera-bot" },
      linkedCategoryId: null,
      catalogBases: ["MZK01"],
      settings: null,
    });
    expect(slack.catalogBases).toEqual([]);
  });

  // PLG-api-session: a limit set is kept until it is sent again; null goes back to the default.
  it("keeps an instance's request limit", async () => {
    signInAs("admin");
    const copyright = instanceOf(await getPluginIndex(), "pi28");
    const draft = {
      names: copyright?.names ?? { en: "Czech copyright" },
      configuration: copyright?.configuration ?? {},
      linkedCategoryId: null,
      settings: null,
    };
    expect(copyright?.requestLimit).toBeNull();
    const limited = await savePluginInstance("pi28", {
      ...draft,
      requestLimit: { requests: 20, minutes: 5 },
    });
    expect(limited.requestLimit).toEqual({ requests: 20, minutes: 5 });
    expect((await savePluginInstance("pi28", draft)).requestLimit).toEqual({
      requests: 20,
      minutes: 5,
    });
    expect(
      (await savePluginInstance("pi28", { ...draft, requestLimit: null })).requestLimit,
    ).toBeNull();
  });

  it("keeps a secret that is not sent again", async () => {
    signInAs("admin");
    const saved = await savePluginInstance("pi18", {
      names: { en: "MZK Slack bot", cs: "MZK Slack bot" },
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
      names: keycloak?.names ?? { en: "MZK Keycloak", cs: "MZK Keycloak" },
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

describe("an instance's policy (PLG-upgrade)", () => {
  it("starts from its version's declarations, and is set on the instance", async () => {
    signInAs("admin");
    const rdcz = instanceOf(await getPluginIndex(), "pi5");
    if (rdcz === undefined) {
      throw new Error("RDCZ production is in the fixtures");
    }

    expect(rdcz.policy).toEqual({ tiers: [], copyStates: ["Digitized"], agent: null });
    const draft = {
      names: rdcz.names,
      configuration: rdcz.configuration,
      linkedCategoryId: null,
      settings: null,
    };
    const saved = await savePluginInstance("pi5", {
      ...draft,
      policy: { ...rdcz.policy, copyStates: ["Digitized", "Revision"] },
    });
    expect(saved.policy.copyStates).toEqual(["Digitized", "Revision"]);
    expect((await savePluginInstance("pi5", draft)).policy.copyStates).toEqual([
      "Digitized",
      "Revision",
    ]);
    expect(
      await refusalOf(
        savePluginInstance("pi5", { ...draft, policy: { ...rdcz.policy, copyStates: ["Lost"] } }),
      ),
    ).toMatchObject({ status: 422, code: "plugin.policy" });
  });

  it("gives a harvester's agent its own name and entry point", async () => {
    signInAs("admin");
    const harvester = instanceOf(await getPluginIndex(), "pi8");
    if (harvester === undefined) {
      throw new Error("Moravian periodicals is in the fixtures");
    }

    const saved = await savePluginInstance("pi8", {
      names: harvester.names,
      configuration: harvester.configuration,
      linkedCategoryId: harvester.linkedCategoryId,
      settings: null,
      policy: { ...harvester.policy, agent: { name: "Moravian sweep", entryPoint: "additions" } },
    });
    expect(saved.policy.agent).toEqual({ name: "Moravian sweep", entryPoint: "additions" });
  });
});

describe("switching an instance off", () => {
  it("says what stops first", async () => {
    signInAs("admin");

    expect(await getPluginImpact("pi14")).toMatchObject({
      kind: "ListGenerator",
      otherEnabledCount: 1,
    });
    expect(await getPluginImpact("pi41")).toMatchObject({ kind: "Identity", userCount: 1 });
    expect((await getPluginImpact("pi25")).openProposalCount).toBeGreaterThan(0);
    // Two runs by hand, and the generated history.
    const history = historicalRuns.filter((run) => run.instanceId === "pi1").length;
    expect(await getPluginImpact("pi1")).toMatchObject({ scheduleCount: 1, runCount: 2 + history });
  });

  it("names the active hooks a delivery channel stops (PLG-delivery-hooks)", async () => {
    signInAs("admin");
    const impact = await getPluginImpact("pi20");

    expect(impact.kind).toBe("DeliveryChannel");
    expect(impact.hookCount).toBeGreaterThan(0);
    expect(impact.hooks.map(({ name }) => name)).toContain("Notify Kramerius on publish");
    expect(impact.hooks).toHaveLength(impact.hookCount);
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
    const others = ["pi24", "pi41", "pi42"];
    for (const instanceId of others) await disablePluginInstance(instanceId);

    expect(await refusalOf(disablePluginInstance("pi22"))).toMatchObject({
      status: 409,
      code: "plugin.last_identity",
    });
    expect(await refusalOf(deletePluginInstance("pi22"))).toMatchObject({ status: 409 });
    for (const instanceId of others) await enablePluginInstance(instanceId);
  });
});

describe("identifier types (DOC-identifiers)", () => {
  const isbnDraft = (configuration: Record<string, string>) => ({
    names: { en: "ISBN", cs: "ISBN" },
    configuration: {
      type: "isbn",
      label_en: "ISBN",
      label_cs: "ISBN",
      pattern: "97[89]\\d{10}",
      normalisation: "trim,dropHyphens",
      checksum: "isbn13",
      ...configuration,
    },
    linkedCategoryId: null,
    settings: { kind: "Identifier" as const, order: 3 },
  });

  it("ships MZK's types as predefined instances, edited but never deleted", async () => {
    signInAs("admin");
    const identifiers = (await getPluginIndex()).instances.filter(
      (instance) => instance.kind === "Identifier",
    );

    expect(identifiers.map(({ name }) => name)).toEqual([
      "Catalog ID",
      "NBN",
      "ISBN",
      "ISSN",
      "Barcode",
    ]);
    expect(identifiers.every((instance) => instance.isPredefined)).toBe(true);
    expect(await refusalOf(deletePluginInstance("pi38"))).toMatchObject({
      status: 409,
      code: "plugin.predefined",
    });
    expect(
      (await savePluginInstance("pi38", isbnDraft({ label_cs: "ISBN-13" }))).configuration,
    ).toMatchObject({ label_cs: "ISBN-13" });
  });

  it("refuses a pattern that is not one, and a second instance of a type", async () => {
    signInAs("admin");

    expect(
      await refusalOf(savePluginInstance("pi38", isbnDraft({ pattern: "97[89" }))),
    ).toMatchObject({ status: 422, code: "plugin.identifier" });
    expect(
      await refusalOf(savePluginInstance("pi38", isbnDraft({ checksum: "luhn" }))),
    ).toMatchObject({ code: "plugin.identifier" });
    expect(
      await refusalOf(
        createPluginInstance({
          ...isbnDraft({}),
          names: { en: "ISBN again", cs: "ISBN again" },
          implementationId: "pt31",
        }),
      ),
    ).toMatchObject({ status: 409, code: "plugin.identifier_taken" });
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
      name: "MarcComparator",
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
          names: { en: "MZK Kramerius 7", cs: "MZK Kramerius 7" },
          configuration: { base_url: "k7.mzk.cz", link: "content" },
          linkedCategoryId: null,
          settings: null,
        }),
      ),
    ).toMatchObject({ status: 404 });
  });
});
