import { expect, journey } from "../../src/journey.ts";
import {
  type Item,
  limitsFor,
  lines,
  seedRequests,
  setDailyLimit,
  submittableItems,
} from "../../src/proposals.ts";

journey("staff/propose-a-batch", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;
  let batchItems: Item[] = [];

  step(1, "propose one batch", async () => {
    page = await as("staff");
    const staffApi = await api("staff");
    const admin = await api("admin");
    const { proposalBatchLimit, proposalDailyLimit: shippedLimit } = limitsFor("staff");
    const { perDay } = (await (await staffApi.get("/api/proposals/rate-limit")).json()) as {
      perDay: number;
    };
    const today = shippedLimit - perDay;
    batchItems = await submittableItems(staffApi, [], proposalBatchLimit * 3 + 1);
    // The shipped 300 limit needs more distinct catalog records than the base seed has; lowering the limit tests the same rule.
    await setDailyLimit(admin, "staff", today + proposalBatchLimit * 3);
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Paste list" }).click();
    await page
      .getByLabel("Items, one per line")
      .fill(lines(batchItems.slice(0, proposalBatchLimit)));
    await page.getByRole("button", { name: "Add these" }).click();
    const rows = page.getByRole("dialog").getByRole("list").last().getByRole("listitem");
    await expect(rows).toHaveCount(proposalBatchLimit);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Submitted as B-/)).toBeVisible();
    const report = dialog.getByRole("list").last();
    await expect(report.getByRole("listitem")).toHaveCount(2);
    await expect(report.getByRole("listitem").nth(0).getByText("6", { exact: true })).toBeVisible();
    await expect(report.getByRole("listitem").nth(1).getByText("4", { exact: true })).toBeVisible();
  });

  step(1, "she names the batch", async () => {
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Propose…" }).click();
    await page.getByRole("tab", { name: "Paste list" }).click();
    await page.getByLabel("Items, one per line").fill(lines(batchItems.slice(0, 10)));
    await page.getByRole("button", { name: "Add these" }).click();
    await page.getByRole("textbox", { name: "Batch name" }).fill("Reading room requests");
  });

  step(2, "warn near the daily limit and refuse the next batch", async () => {
    const staffApi = await api("staff");
    const { proposalBatchLimit } = limitsFor("staff");
    await seedRequests(
      staffApi,
      batchItems.slice(proposalBatchLimit, proposalBatchLimit * 2),
      proposalBatchLimit,
    );
    await page.reload();
    await page.getByRole("button", { name: "Propose…" }).click();
    await expect(page.getByText("Approaching daily limit")).toBeVisible();
    await expect(page.getByText(`${proposalBatchLimit} left today.`)).toBeVisible();
    await page.getByRole("tab", { name: "Paste list" }).click();
    await page
      .getByLabel("Items, one per line")
      .fill(lines(batchItems.slice(proposalBatchLimit * 2, proposalBatchLimit * 3)));
    await page.getByRole("button", { name: "Add these" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Propose…" }).click();
    await expect(
      page.getByText("Daily proposal limit reached: No more proposals today."),
    ).toBeVisible();
  });

  step(2, "the refusal is worded", async () => {
    const extra = batchItems[batchItems.length - 1];
    if (extra === undefined) throw new Error("No distinct catalog item for the refusal check");
    await page.getByRole("tab", { name: "Type it" }).click();
    await page.getByRole("textbox", { name: "Identifier" }).fill(extra.value);
    if (extra.unit !== null) await page.getByLabel("Volume or issue").fill(extra.unit);
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Today’s proposal limit has been reached.")).toBeVisible();
  });
});
