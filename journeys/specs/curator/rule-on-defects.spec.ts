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

  step.fixme(
    3,
    "recheck catalog defects",
    "the two-defect Periodicals review items are Selské noviny (MZK01-001388120: R07:260$c, R04:pages) and Hlas lidu (MZK01-001476310: R03:pages, R07:260$c); neither record is in catalogRepairs",
    async () => {
      await page.getByRole("button", { name: /Selské noviny.*2 outstanding/ }).click();
      await page.getByRole("button", { name: "Recheck" }).click();
      await expect(page.getByText(/Rechecked/)).toBeVisible();
      await expect(page.getByText(/1 outstanding/)).toBeVisible();
    },
  );

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
