import { expect, journey } from "../../src/journey.ts";

journey("admin/hooks-and-tasks", ({ step, as }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "create a publication notification hook", async () => {
    page = await as("admin");
    await page.goto("/hooks");
    await page.getByRole("button", { name: "New hook…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Tell askers when published");
    await dialog.getByLabel("When").click();
    await expect(page.getByRole("menuitemcheckbox", { name: "iteration.published" })).toBeChecked();
    await page.keyboard.press("Escape");
    await dialog.getByRole("combobox").filter({ hasText: "MZK SMTP" }).click();
    await page.getByRole("option", { name: /Mailgun/ }).click();
    await dialog.getByLabel("Email address or recipient").fill("the requester");
    await dialog
      .getByRole("checkbox", { name: "Recipient is a VERA user who can turn this email off" })
      .check();
    await dialog
      .getByLabel("Name in user preferences")
      .fill("Tell me when my document is available");
    await dialog.getByRole("switch", { name: "Enabled by default for recipients" }).check();
    await expect(
      dialog.getByRole("switch", { name: "Enabled by default for recipients" }),
    ).toBeChecked();
    await dialog.getByRole("button", { name: "Create hook" }).click();
    await expect(page.getByRole("button", { name: /Tell askers when published/ })).toBeVisible();
  });

  step(2, "retry a delivery that gave up", async () => {
    page = await as("admin");
    await page.goto("/hooks");
    await page.getByRole("button", { name: /Ops channel on ingest failure/ }).click();
    const detail = page.getByRole("complementary");
    await expect(detail.getByText("2 deliveries gave up")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Retry" })).toHaveCount(3);
    await detail
      .getByText("IT7", { exact: true })
      .locator("xpath=../..")
      .getByRole("button", { name: "Retry" })
      .click();
    await expect(page.getByText(/delivery retried/i)).toBeVisible();
  });

  step(3, "pause a hook with a reason", async () => {
    await page.goto("/hooks");
    await page.getByRole("button", { name: /Ops channel on ingest failure/ }).click();
    const hook = page.getByRole("complementary", { name: "Ops channel on ingest failure" });
    await hook.getByRole("button", { name: "Pause…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Why").fill("The endpoint is under maintenance.");
    await dialog.getByRole("button", { name: "Pause hook" }).click();
    await expect(page.getByText(/Events while paused will not be sent later\./)).toBeVisible();
  });

  step(4, "retry failed additions in their batch", async () => {
    for (const batch of [
      { id: "B-0138", title: "Zemědělské listy", attempts: "4" },
      {
        id: "B-0141",
        name: "proposals-2026-06-19.csv",
        title: "Brno — plán regulace",
        attempts: "2",
      },
    ]) {
      await page.goto("/documents?group=batch");
      if (batch.id === "B-0138") {
        await page.getByRole("searchbox", { name: "Search documents" }).fill(batch.title);
        await page.getByRole("button", { name: /Zemědělské listy/ }).click();
        const detail = page.getByRole("complementary", { name: batch.title });
        const retry = detail.getByRole("button", { name: "Retry the failed one" });
        await expect(retry).toBeVisible();
        await retry.click();
        await expect(
          detail.getByText("Attempts", { exact: true }).locator("xpath=.."),
        ).toContainText(batch.attempts);
        continue;
      }

      const group = page.getByText(batch.id, { exact: true }).locator("xpath=../../..");
      if (batch.name === undefined) throw new Error("The multi-item batch has no name");
      await expect(group).toContainText(batch.name);
      const retry = group.getByRole("button", { name: "Retry the failed one" });
      await expect(retry).toBeVisible();
      await retry.click();

      await page.getByRole("button", { name: /Brno — plán regulace/ }).click();
      const detail = page.getByRole("complementary");
      await expect(detail.getByText("Attempts", { exact: true }).locator("xpath=..")).toContainText(
        batch.attempts,
      );
    }
  });

  step(5, "run the failed task again", async () => {
    await page.goto("/tasks");
    await page.getByRole("searchbox", { name: "Search runs" }).fill("T-9654");
    const failedRun = page.getByRole("row").filter({ hasText: "T-9654" });
    await expect(failedRun).toBeVisible();
    await failedRun.getByRole("button", { name: "RDCZ — registry refresh" }).click();
    const run = page.getByRole("dialog");
    await run.getByRole("button", { name: "Run again" }).click();
    const started = page.getByText(/Started T-/);
    await expect(started).toBeVisible();
    await page.getByRole("button", { name: "Open the run" }).click();
    const running = page.getByRole("dialog");
    await expect(running.getByRole("heading", { name: "RDCZ — registry refresh" })).toBeVisible();
    await expect(running.getByText("Running", { exact: true })).toBeVisible();
  });

  step(6, "pause and resume the harvester schedule", async () => {
    await page.goto("/schedules");
    const row = page.getByRole("row", { name: /RDCZ — registry refresh/ });
    await row.getByRole("button", { name: /Pause/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Why/).fill("Pause while the source is unavailable.");
    await dialog.getByRole("button", { name: "Pause" }).click();
    await expect(row.getByText("paused", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /Resume/ }).click();
    await expect(page.getByText(/resumed/i)).toBeVisible();
  });
});
