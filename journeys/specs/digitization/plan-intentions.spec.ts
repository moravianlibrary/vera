import { expect, journey } from "../../src/journey.ts";

journey("digitization/plan-intentions", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "create a periodicals intention", async () => {
    page = await as("dig-curator");
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    await page.getByRole("button", { name: "New intention", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Regional periodicals Q4");
    await dialog.getByLabel("Project").click();
    await page.getByRole("option", { name: "All work — with or without a project" }).click();
    await dialog.getByLabel("Categories").click();
    await page.getByRole("option", { name: "Periodicals", exact: true }).click();
    await dialog.getByLabel("Target pages").fill("8000");
    await dialog.getByLabel("Counts from").fill("2026-10-01");
    await dialog.getByLabel("Ends").fill("2026-12-31");
    await dialog.getByLabel("Mix").click();
    await page.getByRole("option", { name: "Use Primary mix" }).click();
    await dialog.getByRole("button", { name: "Create intention" }).click();
    await expect(page.getByText(/Upcoming|Running/).first()).toBeVisible();
    await expect(page.getByText(/1 Oct 2026/).first()).toBeVisible();
  });

  step.fixme(
    2,
    "create a scanner scoped intention",
    "creating an intention with a scope condition answers 500 contract.response (L84)",
    async () => {
      await page.getByRole("button", { name: "New intention", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill("Zeutschel scanner");
      await dialog.getByLabel("Project").click();
      await page.getByRole("option", { name: "All work — with or without a project" }).click();
      await dialog.getByLabel("Categories").click();
      await page.getByRole("option", { name: "All categories", exact: true }).click();
      await dialog.getByLabel("Counts from").fill("2026-06-25");
      await dialog.getByLabel("Ends").fill("2026-12-31");
      await dialog.getByLabel("Add a condition on a property").click();
      await page.getByRole("option", { name: "Machines", exact: true }).click();
      await dialog.getByLabel("Zeutschel", { exact: true }).check();
      await expect(dialog.getByText("Machines")).toBeVisible();
      await dialog.getByRole("button", { name: "Create intention" }).click();
      await expect(page.getByText("Zeutschel scanner", { exact: true })).toBeVisible();
    },
  );

  step(3, "edit the Primary mix proportions", async () => {
    await page.getByRole("link", { name: "Category mixes", exact: true }).click();
    await page.getByRole("link", { name: /House mix/ }).click();
    await page.getByRole("button", { name: "Edit proportions" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Save new revision" })).toBeVisible();
    await dialog.getByRole("spinbutton", { name: "Monographs" }).fill("36");
    await dialog.getByRole("spinbutton", { name: "Periodicals" }).fill("44");
    await dialog.getByRole("button", { name: "Save new revision" }).click();
    await expect(page.getByText(/Revision 2/)).toBeVisible();
  });

  step(4, "refuse a child set over 100 percent", async () => {
    await page.getByRole("button", { name: "Edit proportions" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("spinbutton", { name: "Monographs" }).fill("46");
    await expect(dialog.getByText("A set cannot exceed 100%.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
  });

  step(5, "archive last quarter and keep it read only", async () => {
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "June catch-up run" }) });
    await card.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText(/Archived June catch-up run/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  });

  step(6, "set a monthly repeat as admin", async () => {
    page = await as("admin");
    await expect(page.getByRole("button", { name: "User menu" })).toContainText("Petr Dvořák");
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    await page.getByRole("button", { name: "New repeat", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Monthly periodicals — {period}");
    await dialog.getByLabel("Every").click();
    await page.getByRole("option", { name: "Monthly", exact: true }).click();
    await dialog.getByRole("button", { name: "Create repeat" }).click();
    await expect(page.getByText(/next 1 Jul 2026/).first()).toBeVisible();
  });

  step(7, "pin an intention before archiving its old mix", async () => {
    page = await as("admin");
    await expect(page.getByRole("button", { name: "User menu" })).toContainText("Petr Dvořák");
    const index = await api("admin").then((ctx) => ctx.get("/api/mixes"));
    if (!index.ok()) throw new Error(`Mix read failed (${index.status()}): ${await index.text()}`);
    const mixes = (await index.json()) as {
      id: string;
      name: string;
      names: { en: string };
      isPrimary: boolean;
      archivedAt: string | null;
    }[];
    const oldPrimary = mixes.find(({ isPrimary }) => isPrimary);
    const nextPrimary = mixes.find(
      ({ isPrimary, archivedAt }) => !isPrimary && archivedAt === null,
    );
    if (oldPrimary === undefined || nextPrimary === undefined) {
      throw new Error("The seed needs an active Primary mix and another active mix");
    }
    await page.getByRole("link", { name: "Category mixes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Category mixes" })).toBeVisible();
    const nextMixLink = page.getByRole("link", { name: new RegExp(nextPrimary.names.en) });
    await expect(nextMixLink).toBeVisible();
    await nextMixLink.click();
    await page.getByRole("button", { name: "Make Primary", exact: true }).click();
    await expect(page.getByText("Primary mix · default for new mix selections")).toBeVisible();
    const oldMixLink = page.getByRole("link", { name: new RegExp(oldPrimary.names.en) });
    await expect(oldMixLink).toBeVisible();
    await oldMixLink.click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive mix" }).click();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Intentions", exact: true }).click();
    const follower = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Regional periodicals Q4" }) });
    await expect(follower.getByText(/revision \d+ snapshot/)).toBeVisible();
  });
});
