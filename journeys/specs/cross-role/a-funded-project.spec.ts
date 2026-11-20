import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { expect, journey } from "../../src/journey.ts";
import { type Item, itemKey, lines, seedItems } from "../../src/proposals.ts";

type Seed = {
  collections: {
    documents: { id: string; catalogId: string; unit: { value: string } | null }[];
    requests: { documentId: string; decision: string | null }[];
  };
  fakes: {
    registryAnswers: Record<string, unknown[]>;
  };
};

const seed = JSON.parse(readFileSync(resolve(process.cwd(), "../seeds/base.json"), "utf8")) as Seed;

async function projectItems(
  api: APIRequestContext,
  excluded: Item[] = [],
  count = 10,
): Promise<Item[]> {
  const excludedKeys = new Set(excluded.map(itemKey));
  const asked = new Set(
    seed.collections.requests
      .filter(({ decision }) => decision !== "Withdrawn")
      .map(({ documentId }) => {
        const document = seed.collections.documents.find(({ id }) => id === documentId);
        return document === undefined ? "" : `${document.catalogId}|${document.unit?.value ?? ""}`;
      }),
  );
  const copy =
    count === 10
      ? seedItems().find(
          (item) =>
            seed.fakes.registryAnswers[itemKey(item)] !== undefined &&
            !excludedKeys.has(itemKey(item)),
        )
      : undefined;
  if (count === 10 && (copy === undefined || asked.has(itemKey(copy)))) {
    throw new Error("No unasked seeded item with a Kramerius copy is available");
  }
  const selected = copy === undefined ? [] : [copy];
  for (const item of seedItems()) {
    if (selected.length === count) break;
    if (
      asked.has(itemKey(item)) ||
      excludedKeys.has(itemKey(item)) ||
      (copy !== undefined && itemKey(item) === itemKey(copy))
    )
      continue;
    const response = await api.post("/api/proposals/lookup", { data: { items: [item] } });
    const [answer] = (await response.json()) as { kind: string }[];
    if (answer?.kind === "new" || answer?.kind === "inVera") selected.push(item);
  }
  if (selected.length !== count)
    throw new Error(`Only ${selected.length} unasked items are available`);
  return selected;
}

journey("cross-role/a-funded-project", ({ step, as, api, runJobs }) => {
  let curator: Awaited<ReturnType<typeof as>>;
  let projectId = "";
  let items: Item[] = [];

  step(1, "start a project and add Eva", async () => {
    curator = await as("curator");
    await curator.goto("/projects");
    await curator.getByRole("button", { name: /New project/ }).click();
    const dialog = curator.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Grant funded scanning");
    await dialog
      .getByLabel("Description — what it is for; members and curators read it")
      .fill("Documents funded for scanning.");
    await dialog.getByLabel("Starts").fill("2026-07-01");
    await dialog.getByLabel("Ends").fill("2027-06-30");
    await dialog.getByLabel(/Target pages/).fill("1000");
    await dialog.getByRole("button", { name: "Propose project" }).click();
    await expect(curator.getByRole("heading", { name: "Grant funded scanning" })).toBeVisible();
    await curator.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
    const members = curator.getByRole("dialog");
    await members.getByRole("combobox", { name: "Add a person…" }).click();
    await curator.getByRole("option", { name: "Eva Horáková", exact: true }).click();
    await members.getByRole("button", { name: "Save members" }).click();
    await expect(curator.getByText("Eva Horáková", { exact: true })).toBeVisible();
    const response = await (await api("curator")).get("/api/projects");
    const projects = (await response.json()) as { id: string; name: string }[];
    projectId = projects.find(({ name }) => name === "Grant funded scanning")?.id ?? "";
    expect(projectId).not.toBe("");
  });

  step(2, "Eva proposes ten project items", async () => {
    const staff = await as("staff");
    const staffApi = await api("staff");
    items = await projectItems(staffApi);
    await staff.goto("/my-documents");
    await staff.getByRole("button", { name: "Propose…" }).click();
    await staff.getByRole("tab", { name: "Paste list" }).click();
    await staff.getByLabel("Items, one per line").fill(lines(items));
    await staff.getByRole("button", { name: "Add these" }).click();
    const list = staff.getByRole("dialog").getByRole("list").last();
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await staff.getByRole("button", { name: "Continue" }).click();
    const details = staff.getByRole("dialog");
    await details.getByLabel("Project").click();
    await staff
      .getByRole("option", { name: "Grant funded scanning · proposed", exact: true })
      .click();
    await details.getByRole("button", { name: "Submit" }).click();
    const report = staff.getByRole("dialog");
    await expect(report.getByText(/Submitted as B-/)).toBeVisible();
    await expect(report).toContainText(/10\s*proposed — waiting for review/);
    await curator.goto(`/projects/${projectId}`);
    await curator.reload();
    await expect(curator.getByText(/10 documents are proposed into it/)).toBeVisible();
  });

  step(3, "the project proposal check finds the copy", async () => {
    await runJobs();
    await curator.goto(`/projects/${projectId}`);
    await curator.reload();
    await expect(curator.getByText(/except 1 with a copy/)).toBeVisible();
  });

  step(4, "approve nine at High priority", async () => {
    const admin = await as("admin");
    await admin.goto(`/projects/${projectId}`);
    await admin.getByRole("button", { name: "Approve…", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog.getByText(/9 documents pending/)).toBeVisible();
    await expect(dialog.getByText(/It skips/)).toBeVisible();
    await expect(dialog.getByRole("list").last().getByRole("listitem")).toHaveCount(1);
    await dialog.getByLabel("Priority").click();
    await admin.getByRole("option", { name: "High", exact: true }).click();
    await dialog.getByRole("button", { name: /Approve and 9 proposals/ }).click();
    await expect(dialog).toBeHidden();
    await admin.reload();
    await expect(admin.getByRole("heading", { name: "Grant funded scanning" })).toBeVisible();
    await expect(admin.getByText("Approved", { exact: true })).toHaveCount(2);
    await expect(admin.getByText("High", { exact: true }).first()).toBeVisible();
    await admin.goto("/requests?id=D24");
    await expect(admin.getByText(/rescan/i)).toBeVisible();
  });

  step(4, "the nine wait on Requests to be placed", async () => {
    const admin = await as("admin");
    await admin.goto("/requests");
    await expect(
      admin
        .getByRole("button")
        .filter({ hasText: "Grant funded scanning after the project's approval" }),
    ).toHaveCount(9);
  });

  step(5, "see the funded intention", async () => {
    const planner = await as("dig-curator");
    await planner.goto("/intentions");
    await expect(planner.getByRole("heading", { name: "Grant funded scanning" })).toBeVisible();
  });

  step(6, "Eva proposes after approval", async () => {
    const staff = await as("staff");
    const [extra] = await projectItems(await api("staff"), items, 1);
    if (extra === undefined) throw new Error("No additional unasked item is available");
    await staff.goto("/my-documents");
    await staff.getByRole("button", { name: "Propose…" }).click();
    await staff.getByRole("tab", { name: "Type it" }).click();
    await staff.getByRole("textbox", { name: "Identifier" }).fill(extra.value);
    if (extra.unit !== null) await staff.getByLabel("Volume or issue").fill(extra.unit);
    await staff.getByRole("button", { name: "Add" }).click();
    await staff.getByRole("button", { name: "Continue" }).click();
    const details = staff.getByRole("dialog");
    await details.getByLabel("Project").click();
    await staff
      .getByRole("option", { name: "Grant funded scanning · approved", exact: true })
      .click();
    await details.getByRole("button", { name: "Submit" }).click();
    const report = staff.getByRole("dialog");
    await expect(report.getByText("Submitted.", { exact: true })).toBeVisible();
    await expect(report).toContainText(/1\s*proposed — waiting for review/);
    const request = await as("curator");
    const detailResponse = await (await api("curator")).get(`/api/projects/${projectId}`);
    const detail = (await detailResponse.json()) as {
      proposals: { documentId: string; identifier: string }[];
    };
    const identifier = extra.unit === null ? extra.value : `${extra.value} · ${extra.unit}`;
    const proposal = detail.proposals.find((entry) => entry.identifier === identifier);
    if (proposal === undefined) throw new Error(`Project is missing ${identifier}`);
    await request.goto(`/requests?id=${encodeURIComponent(proposal.documentId)}`);
    await expect(request.getByText(/proposed after its approval/)).toBeVisible();
  });

  step(7, "remove Eva and keep her proposals", async () => {
    curator = await as("curator");
    await curator.goto(`/projects/${projectId}`);
    await curator.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
    const members = curator.getByRole("dialog");
    await members.getByRole("button", { name: "Remove Eva Horáková" }).click();
    await expect(members.getByRole("button", { name: "Remove Eva Horáková" })).toHaveCount(0);
    await members.getByRole("button", { name: "Save members" }).click();
    await expect(curator.getByText(/Proposals — 11/)).toBeVisible();
  });
});

journey("cross-role/a-funded-project (alternative)", ({ step, as, api, runJobs }) => {
  let projectId = "";
  let copyItem: Item;
  let staff: Awaited<ReturnType<typeof as>>;

  step(1, "start a project and add Eva", async () => {
    const curator = await as("curator");
    await curator.goto("/projects");
    await curator.getByRole("button", { name: /New project/ }).click();
    const dialog = curator.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Rejected grant project");
    await dialog
      .getByLabel("Description — what it is for; members and curators read it")
      .fill("Documents considered for grant scanning.");
    await dialog.getByLabel("Starts").fill("2026-07-01");
    await dialog.getByLabel("Ends").fill("2027-06-30");
    await dialog.getByLabel(/Target pages/).fill("1000");
    await dialog.getByRole("button", { name: "Propose project" }).click();
    await expect(curator.getByRole("heading", { name: "Rejected grant project" })).toBeVisible();
    await curator.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
    const members = curator.getByRole("dialog");
    await members.getByRole("combobox", { name: "Add a person…" }).click();
    await curator.getByRole("option", { name: "Eva Horáková", exact: true }).click();
    await members.getByRole("button", { name: "Save members" }).click();
    const response = await (await api("curator")).get("/api/projects");
    const projects = (await response.json()) as { id: string; name: string }[];
    projectId = projects.find(({ name }) => name === "Rejected grant project")?.id ?? "";
    expect(projectId).not.toBe("");
  });

  step(2, "Eva proposes ten project items", async () => {
    staff = await as("staff");
    const items = await projectItems(await api("staff"));
    copyItem = items[0] as Item;
    await staff.goto("/my-documents");
    await staff.getByRole("button", { name: "Propose…" }).click();
    await staff.getByRole("tab", { name: "Paste list" }).click();
    await staff.getByLabel("Items, one per line").fill(lines(items));
    await staff.getByRole("button", { name: "Add these" }).click();
    await expect(
      staff.getByRole("dialog").getByRole("list").last().getByRole("listitem"),
    ).toHaveCount(10);
    await staff.getByRole("button", { name: "Continue" }).click();
    const details = staff.getByRole("dialog");
    await details.getByLabel("Project").click();
    await staff
      .getByRole("option", { name: "Rejected grant project · proposed", exact: true })
      .click();
    await details.getByRole("button", { name: "Submit" }).click();
    const report = staff.getByRole("dialog");
    await expect(report.getByText(/Submitted as B-/)).toBeVisible();
    await expect(report).toContainText(/10\s*proposed — waiting for review/);
  });

  step(3, "the project proposal check finds the copy", async () => {
    await runJobs();
    await staff.goto("/my-documents");
    const copy = staff.getByRole("button", {
      name: new RegExp(`${copyItem.value}.*${copyItem.unit}`),
    });
    await expect(copy).toContainText("Read it in Kramerius");
  });

  step("4b", "reject with a reason", async () => {
    const admin = await as("admin");
    await admin.goto(`/projects/${projectId}`);
    await admin.getByRole("button", { name: "Reject…", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    const reason = "The grant will fund a different collection.";
    await dialog.getByLabel("Reason").fill(reason);
    await dialog.getByRole("button", { name: "Reject project", exact: true }).click();
    await expect(admin.getByText("Rejected", { exact: true })).toHaveCount(2);
    await staff.goto("/my-documents");
    const rejectedRow = staff.getByRole("button", {
      name: new RegExp(`${copyItem.value}.*${copyItem.unit}`),
    });
    await rejectedRow.click();
    await expect(staff.getByRole("article")).toContainText(reason);
    const planner = await as("dig-curator");
    await planner.goto("/intentions");
    await expect(planner.getByText(/Archived/)).toBeVisible();
    await expect(planner.getByRole("heading", { name: "Rejected grant project" })).toBeVisible();
  });
});
