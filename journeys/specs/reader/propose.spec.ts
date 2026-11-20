import { expect, journey } from "../../src/journey.ts";
import { limitsFor, seedRequests, setDailyLimit, submittableItems } from "../../src/proposals.ts";

journey("reader/propose", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "My Documents is the only entry", async () => {
    page = await as("reader");
    await expect(page.getByRole("link", { name: "My Documents" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Watchlists" })).toBeVisible();
  });

  step(2, "the identifier is checked as the item lands in the list", async () => {
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Type it" }).click();
    await page.getByRole("textbox", { name: "Identifier" }).fill("not-an-identifier");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Not a known identifier")).toBeVisible();
    await page.getByRole("button", { name: "Remove not-an-identifier" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  step(3, "read four pasted items", async () => {
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Paste list" }).click();
    await page
      .getByLabel("Items, one per line")
      .fill(
        "MZK01-001622010;1889;research\n# comment\nMZK01-001452200;MZK-2801-000341\n1801-1233\n978-80-7325-456-8",
      );
    await page.getByRole("button", { name: "Add these" }).click();
    const items = page.getByRole("dialog").getByRole("list").last().getByRole("listitem");
    await expect(items).toHaveCount(4);
    await expect(items.filter({ hasText: "# comment" })).toHaveCount(0);
    await expect(page.getByText("Which volume?")).toBeVisible();
    await expect(items.filter({ hasText: "1801-1233" }).getByText("Which volume?")).toBeVisible();
    await expect(page.getByText("you ask for it already; skipped")).toBeVisible();
  });

  step(4, "choose a volume and submit", async () => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "1801-1233" })
      .getByLabel("Volume or issue")
      .click();
    await page.getByRole("option", { name: "roč. 1" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    const dialog = page.getByRole("dialog");
    const proposed = dialog
      .getByRole("listitem")
      .filter({ hasText: "proposed — waiting for review" });
    await expect(proposed).toContainText("proposed — waiting for review");
    await expect(proposed.getByText("2", { exact: true })).toBeVisible();
    const joined = dialog.getByRole("listitem").filter({ hasText: "joined work already in VERA" });
    await expect(joined).toContainText("joined work already in VERA — you follow it");
    await expect(joined.getByText("1", { exact: true })).toBeVisible();
    const skipped = dialog.getByRole("listitem").filter({ hasText: "skipped" });
    await expect(skipped.getByText("1", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Download skipped" })).toBeVisible();
  });

  step(5, "refuse eleven items", async () => {
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Paste list" }).click();
    await page
      .getByLabel("Items, one per line")
      .fill(
        Array.from(
          { length: 11 },
          (_, index) => `MZK03-000${String(100001 + index).slice(-6)}`,
        ).join("\n"),
      );
    await page.getByRole("button", { name: "Add these" }).click();
    await expect(page.getByText("1 not added: at most 10 at once.")).toBeVisible();
  });

  step(6, "refuse the hundredth item", async () => {
    const requester = await api("reader");
    const admin = await api("admin");
    const { proposalBatchLimit, proposalDailyLimit: shippedLimit } = limitsFor("reader");
    const { perDay } = (await (await requester.get("/api/proposals/rate-limit")).json()) as {
      perDay: number;
    };
    const today = shippedLimit - perDay;
    const items = await submittableItems(requester, [], 2);
    // The shipped 100 limit needs more distinct catalog records than the base seed has; lowering the limit tests the same rule.
    await setDailyLimit(admin, "reader", today + 1);
    await seedRequests(requester, items.slice(0, 1), proposalBatchLimit);
    await page.reload();
    await page.getByRole("button", { name: "Propose…" }).click();
    await expect(
      page.getByText("Daily proposal limit reached: No more proposals today."),
    ).toBeVisible();
  });

  step(6, "the refusal is worded", async () => {
    const extra = (await submittableItems(await api("reader"), [], 1))[0];
    if (extra === undefined) throw new Error("No distinct catalog item for the refusal check");
    await page.getByRole("tab", { name: "Type it" }).click();
    await page.getByRole("textbox", { name: "Identifier" }).fill(extra.value);
    if (extra.unit !== null) await page.getByLabel("Volume or issue").fill(extra.unit);
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // With none left, Submit is not offered; the 429's wording is the dialog's unit test (L82).
    await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
    await expect(page.getByText("Daily proposal limit · 0 left today")).toBeVisible();
  });
});
