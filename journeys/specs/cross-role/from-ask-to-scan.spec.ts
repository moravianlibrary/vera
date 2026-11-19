import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, journey } from "../../src/journey.ts";
import { type Item, seedItems } from "../../src/proposals.ts";

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
  };
  fakes: {
    catalogRecords: {
      catalogId: string;
      title: string;
      type: string;
      units: string[] | null;
    }[];
    ingest: Record<string, { defects: { field: string }[] }>;
  };
};

const seed = JSON.parse(readFileSync(resolve(process.cwd(), "../seeds/base.json"), "utf8")) as Seed;

journey("cross-role/from-ask-to-scan", ({ step, as, api, clock, runJobs, outbox }) => {
  let reader: Awaited<ReturnType<typeof as>>;
  let item: Item;
  let title = "";
  let documentId = "";
  let iterationId = "";
  let listId = "";
  const link = "https://www.digitalniknihovna.cz/mzk/uuid/from-ask-to-scan";
  step(1, "ask for a volume", async () => {
    reader = await as("reader");
    const requester = await api("reader");
    const periodicalsCustody = seed.collections.pluginInstances.find(
      (instance) =>
        instance.name === "Serials" &&
        instance.configuration.expr === '.document.type == "Periodical"' &&
        instance.settings?.kind === "Custody",
    );
    expect(periodicalsCustody?.settings?.custodyId).toBe("pc1");
    const existingRequests = new Set(seed.collections.requests.map(({ documentId }) => documentId));
    const existingVolumes = new Set(
      seed.collections.documents
        .filter((document) => existingRequests.has(document.id))
        .map((document) => `${document.catalogId}|${document.unit?.value ?? ""}`),
    );
    let chosen: Item | undefined;
    const records = new Map(seed.fakes.catalogRecords.map((record) => [record.catalogId, record]));
    for (const candidate of seedItems()) {
      const record = records.get(candidate.value);
      if (
        record?.type !== "Periodical" ||
        candidate.unit === null ||
        !seed.fakes.ingest[candidate.value]?.defects.some(({ field }) => field === "pages") ||
        existingVolumes.has(`${candidate.value}|${candidate.unit}`)
      ) {
        continue;
      }
      const result = await requester.post("/api/proposals/lookup", {
        data: { items: [candidate] },
      });
      const [answer] = (await result.json()) as { kind: string }[];
      if (answer?.kind === "new") {
        chosen = candidate;
        title = record.title;
        break;
      }
    }
    if (!chosen)
      throw new Error("No unasked periodical volume without a catalog page count is submittable");
    item = chosen;
    await reader.getByRole("button", { name: "Propose…" }).click();
    await reader.getByRole("tab", { name: "Type it" }).click();
    await reader.getByRole("textbox", { name: "Identifier" }).fill(item.value);
    await reader.getByLabel("Volume or issue").fill(item.unit ?? "");
    await reader.getByRole("button", { name: "Add" }).click();
    await reader.getByRole("button", { name: "Continue" }).click();
    await reader
      .getByRole("textbox", { name: "Why" })
      .fill("For my research on regional newspapers.");
    await reader.getByRole("button", { name: "Submit" }).click();
    await expect(reader.getByRole("dialog").getByText("Submitted.", { exact: true })).toBeVisible();
    await reader.goto("/my-documents");
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    await expect(row).toContainText("Waiting for review");
    await row.click();
    documentId = new URL(reader.url()).searchParams.get("id") ?? "";
    expect(documentId).not.toBe("");
  });

  step(2, "custody places the proposal", async () => {
    await runJobs();
    const curator = await as("curator");
    await curator.goto("/requests");
    await curator.reload();
    await expect(
      curator.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) }),
    ).toBeVisible();
  });

  step(3, "approve into Regional", async () => {
    const curator = await as("curator");
    await curator.goto("/requests");
    await curator
      .getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) })
      .click();
    await curator.getByLabel("Category").click();
    await curator.getByRole("option", { name: "Periodicals / Regional", exact: true }).click();
    await curator.getByLabel("Priority").click();
    await curator.getByRole("option", { name: "Normal", exact: true }).click();
    await curator.getByRole("button", { name: "Approve", exact: true }).click();
    await reader.goto(`/my-documents?id=${encodeURIComponent(documentId)}`);
    await reader.reload();
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    // The worker ingests right after approval, so Being added may already have moved on.
    await expect(row).toContainText(/Being added|Being checked/);
    await expect(curator.getByText(/Decided: Approved/)).toBeVisible();
    const curatorApi = await api("curator");
    const detail = await curatorApi.get(`/api/documents/${documentId}`);
    const body = (await detail.json()) as {
      record: { iterations: { id: string; progress: string }[] };
    };
    const iteration = body.record.iterations.at(-1);
    iterationId = iteration?.id ?? "";
    expect(iterationId).not.toBe("");
    expect(["Enqueued", "Ready"]).toContain(iteration?.progress);
  });

  step(4, "ingest and review the missing page count", async () => {
    await runJobs();
    const curator = await as("curator");
    await curator.getByRole("link", { name: "Documents Validations" }).click();
    await curator.reload();
    await expect(curator.getByRole("button", { name: new RegExp(title) })).toContainText(
      "Review needed",
    );
    await reader.reload();
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    await expect(row).toContainText("Being checked");
  });

  step(5, "enter the counted pages", async () => {
    const curator = await as("curator");
    await curator.goto(`/review/documents?id=${encodeURIComponent(iterationId)}`);
    await curator.getByRole("button", { name: "Enter page count…" }).click();
    await curator.getByLabel("Pages, counted").fill("450");
    await curator.getByRole("button", { name: "Save and recheck" }).click();
    await expect(
      curator.getByText(/The checks found nothing left to rule on.*Ready/),
    ).toBeVisible();
    await reader.reload();
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    await expect(row).toContainText("Waiting to be scheduled");
  });

  step(6, "schedule for next Monday", async () => {
    const planner = await as("dig-curator");
    await planner.goto("/lists");
    await planner.getByRole("link", { name: "New list", exact: true }).click();
    await planner.getByLabel("Name").fill("From ask to scan");
    await planner.getByLabel("When it starts").click();
    await planner.getByRole("option", { name: "Starts on", exact: true }).click();
    await planner.getByLabel("Starts on").fill("2026-06-29");
    await planner.getByLabel("Ends").fill("2026-07-03");
    await planner.getByLabel("Target pages").fill("450");
    const pool = await (await api("dig-curator")).get("/api/digitization-lists/pool?limit=100");
    const payload = (await pool.json()) as {
      items: {
        iteration: { id: string };
        document: { catalogId: string; unit: { value: string } | null };
      }[];
    };
    const member = payload.items.find(
      ({ iteration, document }) =>
        iteration.id === iterationId &&
        document.catalogId === item.value &&
        document.unit?.value === item.unit,
    );
    if (!member) throw new Error(`Ready pool is missing ${item.value} ${item.unit}`);
    const available = planner.getByRole("region", { name: "Ready to list" });
    const checkbox = available.getByRole("checkbox", { name: new RegExp(iterationId) });
    await checkbox.check();
    await available.getByRole("button", { name: /Add 1$/ }).click();
    await planner.getByRole("button", { name: "Save", exact: true }).click();
    await expect(planner.getByRole("button", { name: /From ask to scan/ })).toContainText(
      "Planned",
    );
    listId = new URL(planner.url()).searchParams.get("id") ?? "";
    expect(listId).not.toBe("");
    await reader.reload();
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    await expect(row).toContainText("Scheduled");
    await clock({ at: "2026-06-29T06:00:00Z" });
    await planner.goto(`/lists?id=${encodeURIComponent(listId)}`);
    await expect(planner.getByRole("button", { name: /From ask to scan/ })).toContainText(
      "In progress",
    );
  });

  step(7, "mark the list Done", async () => {
    const planner = await as("dig-curator");
    await planner.goto(`/lists?id=${encodeURIComponent(listId)}`);
    await planner.getByRole("button", { name: /From ask to scan/ }).click();
    await planner.getByRole("button", { name: /Mark Done/ }).click();
    const dialog = planner.getByRole("dialog");
    await dialog.getByRole("button", { name: /Mark Done/ }).click();
    await expect(planner.getByRole("button", { name: /From ask to scan/ })).toContainText("Done");
    await reader.reload();
    const row = reader.getByRole("button", { name: new RegExp(`^${item.value} · ${item.unit}`) });
    await expect(row).toContainText("Available");
  });

  step(8, "publish the scan link", async () => {
    const curator = await as("curator");
    await curator.goto(`/documents?id=${encodeURIComponent(documentId)}`);
    await curator.reload();
    await curator.getByRole("button", { name: "More", exact: true }).click();
    await curator.getByRole("menuitem", { name: /Add link/ }).click();
    const dialog = curator.getByRole("dialog");
    await dialog.getByLabel("Link").fill(link);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(curator.getByRole("button", { name: new RegExp(title) })).toContainText(
      "Published",
    );
    await reader.reload();
    await expect(reader.getByRole("link", { name: "Read it in VERA" })).toHaveAttribute(
      "href",
      link,
    );
    await clock({ advance: { minutes: 61 } });
    const messages = JSON.stringify(await outbox());
    expect(messages).toContain("iteration.published");
    expect(messages).toContain("tomas.marek");
  });

  step(9, "read the document history", async () => {
    await reader.goto(`/my-documents?id=${encodeURIComponent(documentId)}`);
    const detail = reader.getByRole("article");
    await expect(detail.getByText("What has happened", { exact: true })).toBeVisible();
    await expect(detail.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(detail.getByText("Digitized", { exact: true })).toBeVisible();
    await expect(detail.getByText("Available to read", { exact: true })).toBeVisible();
    await expect(detail.getByText(/Kateřina Novotná|Martin Svoboda/)).toHaveCount(0);
  });
});
