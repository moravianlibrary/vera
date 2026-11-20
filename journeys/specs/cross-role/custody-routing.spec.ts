import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { request } from "@playwright/test";
import { expect, journey } from "../../src/journey.ts";

type Item = { type: "catalogId"; value: string; unit: string | null };

type Seed = {
  collections: {
    documents: {
      id: string;
      catalogId: string;
      unit: { value: string } | null;
    }[];
    requests: { documentId: string }[];
    pluginInstances: {
      name: string;
      configuration: { expr?: string };
      settings: { kind?: string; custodyId?: string } | null;
    }[];
    requestCustodies: {
      id: string;
      name: string;
      memberIds: string[];
      groupIds: string[];
    }[];
    users: { id: string; name: string; kind: string }[];
    userAccess: Record<string, { handRoleIds: string[]; mappedRoles: { roleId: string }[] }>;
  };
  fakes: {
    catalogRecords: { catalogId: string; title: string; type: string; units: string[] | null }[];
    custodyRules: {
      custodyId: string;
      documentType?: string;
      projectId?: string;
      catalogId?: string;
    }[];
  };
};

const seed = JSON.parse(readFileSync(resolve(process.cwd(), "../seeds/base.json"), "utf8")) as Seed;
const installation = JSON.parse(
  readFileSync(resolve(process.cwd(), "../seeds/installation.json"), "utf8"),
) as { collections: { roles: { id: string; grants: { permission: string }[] }[] } };

journey("cross-role/custody-routing", ({ step, as, api, runJobs }) => {
  const backend = process.env.VERA_JOURNEYS_BACKEND ?? "http://127.0.0.1:8091";
  const frontend = process.env.VERA_JOURNEYS_URL ?? "http://127.0.0.1:5290";
  const pendingDocuments = new Set(seed.collections.requests.map(({ documentId }) => documentId));
  const requestedIdentities = new Set(
    seed.collections.documents
      .filter((document) => pendingDocuments.has(document.id))
      .map((document) => `${document.catalogId}|${document.unit?.value ?? ""}`),
  );
  const custodyInstance = (name: string) =>
    seed.collections.pluginInstances.find(
      (instance) =>
        instance.name === name &&
        instance.settings?.kind === "Custody" &&
        instance.settings.custodyId !== undefined,
    );
  const serials = custodyInstance("Serials");
  const prints = custodyInstance("Printed 1800–1899");
  const periodicalRule = seed.fakes.custodyRules.find(
    (rule) => rule.documentType === "Periodical" && rule.custodyId === serials?.settings?.custodyId,
  );
  const catalogRule = seed.fakes.custodyRules.find(
    (rule) => rule.catalogId !== undefined && rule.custodyId === prints?.settings?.custodyId,
  );
  const periodical = seed.fakes.catalogRecords.find(
    (record) =>
      periodicalRule?.documentType === record.type &&
      record.units?.some((unit) => /^185\d$/.test(unit)) === true &&
      catalogRule?.catalogId === record.catalogId &&
      !record.units.some((unit) => requestedIdentities.has(`${record.catalogId}|${unit}`)),
  );
  const map = seed.fakes.catalogRecords.find(
    (record) =>
      record.type === "Map" &&
      record.units === null &&
      !seed.fakes.custodyRules.some(
        (rule) =>
          (rule.documentType === undefined || rule.documentType === record.type) &&
          (rule.projectId === undefined || rule.projectId === "") &&
          (rule.catalogId === undefined || rule.catalogId === record.catalogId),
      ) &&
      !requestedIdentities.has(`${record.catalogId}|`),
  );
  if (serials?.settings?.custodyId === undefined || prints?.settings?.custodyId === undefined) {
    throw new Error("The seed is missing the Serial and Printed custody rules");
  }
  const printsCustodyId = prints.settings.custodyId;
  if (!periodical || !map || !periodicalRule || !catalogRule) {
    throw new Error(
      "The seed has no unasked 1850s periodical and unmatched map for custody routing",
    );
  }

  const periodicalUnit = periodical.units?.find((unit) => /^185\d$/.test(unit));
  if (periodicalUnit === undefined) throw new Error("The periodical has no 1850s volume");
  const item: Item = { type: "catalogId", value: periodical.catalogId, unit: periodicalUnit };
  const mapItem: Item = { type: "catalogId", value: map.catalogId, unit: null };
  const nextPeriodicalUnit = periodical.units?.find(
    (unit) => /^185\d$/.test(unit) && unit !== periodicalUnit,
  );
  if (nextPeriodicalUnit === undefined)
    throw new Error("The periodical has no second 1850s volume");
  const renamedCustody = "Nineteenth-century prints";
  let documentId = "";

  const ask = async (page: Awaited<ReturnType<typeof as>>, proposal: Item) => {
    await page.goto("/my-documents");
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Type it" }).click();
    await page.getByRole("textbox", { name: "Identifier" }).fill(proposal.value);
    if (proposal.unit !== null) await page.getByLabel("Volume or issue").fill(proposal.unit);
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Why" }).fill("For my research on Prague.");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("dialog").getByText("Submitted.", { exact: true })).toBeVisible();
  };

  step(1, "place the periodical in both custodies", async () => {
    const reader = await as("reader");
    const requester = await api("reader");
    const lookup = await requester.post("/api/proposals/lookup", { data: { items: [item] } });
    const [answer] = (await lookup.json()) as { kind: string }[];
    expect(answer?.kind).toBe("new");
    await ask(reader, item);
    await reader.goto("/my-documents");
    const readerRow = reader.getByRole("button", {
      name: new RegExp(`^${item.value} · ${item.unit}`),
    });
    await expect(readerRow).toContainText("Waiting for review");
    await readerRow.click();
    documentId = new URL(reader.url()).searchParams.get("id") ?? "";
    expect(documentId).not.toBe("");

    await runJobs();
    const curator = await as("curator");
    await curator.goto("/requests");
    await curator.reload();
    const requestRow = curator.getByRole("button", {
      name: new RegExp(`^${item.value} · ${item.unit}`),
    });
    await expect(requestRow).toBeVisible();
    await requestRow.click();
    const detail = curator.getByRole("complementary");
    await expect(detail.getByText("Periodicals", { exact: true })).toBeVisible();
    await expect(detail.getByText("19th-century prints", { exact: true })).toBeVisible();

    const memberId = seed.collections.requestCustodies.find(
      (custody) => custody.id === prints.settings?.custodyId,
    )?.memberIds[0];
    if (memberId === undefined) throw new Error("The print custody has no seeded member");
    const session = await fetch(`${backend}/_engine/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberId }),
    });
    if (!session.ok) throw new Error(`Session for custody member failed (${session.status})`);
    const cookie = session.headers.get("set-cookie")?.match(/vera_session=([^;]+)/)?.[1];
    if (!cookie) throw new Error("Session for custody member did not set vera_session");
    const memberApi = await request.newContext({
      baseURL: frontend,
      extraHTTPHeaders: { Cookie: `vera_session=${cookie}` },
    });
    try {
      const response = await memberApi.get("/api/requests?limit=200");
      expect(response.ok()).toBeTruthy();
      const result = (await response.json()) as {
        items: {
          custodyIds: string[];
          record: {
            document: { catalogId: string; unit: { value: string } | null };
          };
        }[];
      };
      const visible = result.items.find(
        (row) =>
          row.record.document.catalogId === item.value &&
          row.record.document.unit?.value === item.unit,
      );
      expect(visible?.custodyIds).toContain(printsCustodyId);
    } finally {
      await memberApi.dispose();
    }
  });

  step(2, "place the map in fallback", async () => {
    const reader = await as("reader");
    const lookup = await (await api("reader")).post("/api/proposals/lookup", {
      data: { items: [mapItem] },
    });
    const [answer] = (await lookup.json()) as { kind: string }[];
    expect(answer?.kind).toBe("new");
    await ask(reader, mapItem);
    await runJobs();
    const admin = await as("admin");
    await admin.goto("/requests");
    await admin.reload();
    const row = admin.getByRole("button", { name: new RegExp(`^${mapItem.value}`) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(admin.getByText(/Fallback · no rule placed it/)).toBeVisible();
  });

  step(3, "add a member who cannot decide", async () => {
    const admin = await as("admin");
    const decidingRoleIds = new Set(
      installation.collections.roles
        .filter((role) => role.grants.some((grant) => grant.permission === "request.decide"))
        .map((role) => role.id),
    );
    const member = seed.collections.users.find((user) => {
      const access = seed.collections.userAccess[user.id];
      const heldRoleIds = [
        ...(access?.handRoleIds ?? []),
        ...(access?.mappedRoles ?? []).map(({ roleId }) => roleId),
      ];
      return user.kind === "person" && !heldRoleIds.some((roleId) => decidingRoleIds.has(roleId));
    });
    if (member === undefined) throw new Error("The seed has no person without request.decide");

    await admin.goto("/access?view=custodies");
    await admin.getByRole("row").filter({ hasText: "19th-century prints" }).click();
    const custody = admin.getByRole("complementary", { name: "19th-century prints" });
    await custody.getByRole("button", { name: "More", exact: true }).click();
    await admin.getByRole("menuitem", { name: "Members…" }).click();
    const dialog = admin.getByRole("dialog");
    const memberChoice = dialog.getByRole("checkbox", {
      name: new RegExp(`${member.name} — no role reaches proposals$`),
    });
    await expect(memberChoice).toBeVisible();
    await memberChoice.check();
    await dialog.getByRole("button", { name: "Save members" }).click();
    await expect(custody.getByText("no role reaches it", { exact: true })).toBeVisible();
  });

  step(4, "rename the custody and place another proposal", async () => {
    const admin = await as("admin");
    await admin.goto("/access?view=custodies");
    await admin.getByRole("row").filter({ hasText: "19th-century prints" }).click();
    const custody = admin.getByRole("complementary", { name: "19th-century prints" });
    await custody.getByRole("button", { name: "Edit…", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(renamedCustody);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(admin.getByRole("complementary", { name: renamedCustody })).toBeVisible();

    const secondItem: Item = {
      type: "catalogId",
      value: periodical.catalogId,
      unit: nextPeriodicalUnit,
    };
    const reader = await as("reader");
    await ask(reader, secondItem);
    await runJobs();
    await admin.goto("/requests");
    await admin.reload();
    const row = admin.getByRole("button", {
      name: new RegExp(`^${secondItem.value} · ${secondItem.unit}`),
    });
    await expect(row).toBeVisible();
    await row.click();
    await expect(
      admin.getByRole("complementary").getByText(renamedCustody, { exact: true }),
    ).toBeVisible();
  });

  step(5, "approve the periodical", async () => {
    const curator = await as("curator");
    await curator.goto("/requests");
    const row = curator.getByRole("button", {
      name: new RegExp(`^${item.value} · ${item.unit}`),
    });
    await expect(row).toBeVisible();
    await row.click();
    await curator.getByLabel("Category").click();
    await curator.getByRole("option", { name: "Periodicals / Regional", exact: true }).click();
    await curator.getByLabel("Priority").click();
    await curator.getByRole("option", { name: "Normal", exact: true }).click();
    await curator.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(curator.getByText(/Decided: Approved/)).toBeVisible();

    await curator.goto(`/documents?id=${encodeURIComponent(documentId)}`);
    await expect(
      curator.getByRole("article").getByText("Periodicals / Regional", { exact: true }),
    ).toBeVisible();
    await curator.goto("/requests?decision=Pending");
    await expect(
      curator.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) }),
    ).toHaveCount(0);
  });
});
