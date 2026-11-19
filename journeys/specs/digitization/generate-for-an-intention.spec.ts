import { expect, journey } from "../../src/journey.ts";

journey("digitization/generate-for-an-intention", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;
  let intentionId = "";

  step(1, "the intention shows its pace", async () => {
    page = await as("dig-curator");
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    // Create the missing running, behind-pace intention through the same act the page offers.
    const response = await (await api("dig-curator")).post("/api/intentions", {
      data: {
        name: "NDK Periodika catch-up",
        description: "Catch up the periodicals scanning plan.",
        funding: { kind: "any" },
        scopeCategoryId: "c2",
        scopeConditions: [],
        countsFrom: "2026-01-01",
        endsOn: "2026-12-31",
        targetPages: 100000,
        mix: { kind: "primary" },
      },
    });
    if (response.status() !== 201) {
      throw new Error(`Intention setup failed (${response.status()}): ${await response.text()}`);
    }
    const row = (await response.json()) as { intention: { id: string } };
    intentionId = row.intention.id;
    expect(intentionId).toBeTruthy();
    await page.reload();
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "NDK Periodika catch-up" }) });
    await expect(card.getByText("Behind pace", { exact: true })).toBeVisible();
    await expect(card.getByText(/Needs .* pp\/week/)).toBeVisible();
  });

  step(2, "open a catch-up generation", async () => {
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "NDK Periodika catch-up" }) });
    await card.getByRole("link", { name: /Generate catch-up/ }).click();
    await expect(page).toHaveURL(/\/lists\/new\?generate/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Pages — required")).not.toHaveValue("");
    await expect(page.getByRole("combobox", { name: /Shape by/ })).toContainText(
      "NDK Periodika catch-up",
    );
  });

  step(3, "generate a draft in mix order", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Generate draft/ }).click();
    await expect(page.getByText(/categories short or unallocated/)).toBeVisible();
    await expect(page.getByText(/Urgent priority/).first()).toBeVisible();
    await expect(page.getByText(/High priority/).first()).toBeVisible();
  });

  step(4, "save a reduced draft with provenance", async () => {
    const dialog = page.getByRole("dialog");
    const items = dialog.getByRole("list").nth(1).getByRole("listitem");
    await expect(items).toHaveCount(7);
    await dialog.getByRole("button", { name: "Put 7 on the list" }).click();
    const onList = page.getByRole("region", { name: "On this list" });
    const picks = onList.getByRole("checkbox");
    await expect(picks).toHaveCount(7);
    await picks.nth(0).check();
    await picks.nth(1).check();
    await onList.getByRole("button", { name: /Take off 2/ }).click();
    await page.getByLabel("Name").fill("NDK catch-up");
    await page.getByLabel("Ends").fill("2026-07-03");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/PriorityThenMix/)).toBeVisible();
    await expect(page.getByRole("link", { name: "NDK Periodika catch-up" })).toBeVisible();
    await expect(page.getByText(/its mix as it was on/)).toBeVisible();
    await expect(page).toHaveURL(/\/lists\?id=/);
    const listId = new URL(page.url()).searchParams.get("id");
    if (listId === null) throw new Error("Generated list has no id in its URL");
    const response = await (await api("dig-curator")).get(`/api/digitization-lists/${listId}`);
    if (!response.ok())
      throw new Error(`List read failed (${response.status()}): ${await response.text()}`);
    const detail = (await response.json()) as {
      row: {
        list: {
          generated: { intentionId: string; mixRevision: number | null; generator: string } | null;
        };
      };
    };
    expect(detail.row.list.generated?.intentionId).toBe(intentionId);
    expect(detail.row.list.generated?.mixRevision).not.toBeNull();
    expect(detail.row.list.generated?.generator).toBe("PriorityThenMix 1.2.0");
  });

  step(5, "the plan count grows without attachment", async () => {
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "NDK Periodika catch-up" }) });
    await expect(card).toBeVisible();
    const planned = (await card.innerText()).match(/Planned\s+([\d,]+)\s*\/\s*100,000 pp/);
    expect(planned).not.toBeNull();
    expect(Number(planned?.[1].replaceAll(",", ""))).toBeGreaterThan(0);
    await expect(page.getByText(/Nothing is attached to an intention/)).toBeVisible();
  });
});
