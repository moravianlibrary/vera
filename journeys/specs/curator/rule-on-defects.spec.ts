import { expect, journey } from "../../src/journey.ts";

journey("curator/rule-on-defects", ({ step, as }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "show only validations in category custody", async () => {
    page = await as("curator");
    await page.getByRole("link", { name: "Documents Validations" }).click();
    await expect(page.getByRole("button", { name: /Selské noviny.*2 outstanding/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Čas.*Forbidden/ })).toBeVisible();
  });

  step(2, "enter the missing page count", async () => {
    await page.getByRole("button", { name: /Brněnské noviny.*no catalog extent/ }).click();
    await page.getByRole("button", { name: "Enter page count…" }).click();
    await page.getByLabel("Pages, counted").fill("450");
    await page.getByRole("button", { name: "Save and recheck" }).click();
    await expect(page.getByText(/The checks found nothing left to rule on.*Ready/)).toBeVisible();
  });

  step(3, "recheck catalog defects", async () => {
    await page.getByRole("button", { name: /Hlas lidu.*1 outstanding/ }).click();
    await page.getByRole("button", { name: "Recheck" }).click();
    await expect(page.getByText("Rechecked", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Only the predictor answered (tier 20); no catalog extent on the record."),
    ).toBeVisible();
    await expect(page.getByText(/MARC 260\$c changed upstream/)).toHaveCount(0);
  });

  step(4, "accept the outstanding defects with a note", async () => {
    await page.getByRole("link", { name: "Documents Validations" }).click();
    await page.getByRole("button", { name: /Selské noviny.*2 outstanding/ }).click();
    await page.getByLabel("Note").fill("Accepting for this planning round.");
    await page.getByRole("button", { name: /^Accept all/ }).click();
    await expect(page.getByText("Accepted — 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Accepting for this planning round.").first()).toBeVisible();
  });

  step(5, "revoke acceptance", async () => {
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(page.getByText("Review needed", { exact: true }).first()).toBeVisible();
  });

  step(6, "deny with a public reason", async () => {
    await page.getByRole("button", { name: "Deny…", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What they are told").fill("The catalog defects are substantial.");
    await dialog.getByLabel("Internal note").fill("Please correct the record before scheduling.");
    await dialog.getByRole("button", { name: /^Deny/ }).click();
    await expect(page.getByText("Denied in review", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("The catalog defects are substantial.").first()).toBeVisible();
  });

  step(7, "ask an administrator to overrule", async () => {
    await page.getByRole("button", { name: /Čas.*Forbidden/ }).click();
    await expect(page.getByText(/administrator/i)).toBeVisible();
  });
});
