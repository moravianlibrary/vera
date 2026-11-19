import { expect, journey } from "../../src/journey.ts";

journey("curator/run-a-project", ({ step, as }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "start a proposed project", async () => {
    page = await as("curator");
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("button", { name: /New project|Start a project/ }).click();
    await page.getByLabel("Name").fill("Regional periodicals grant");
    await page.getByLabel("Description").fill("Regional periodicals for digitization.");
    await page.getByLabel("Starts").fill("2026-07-01");
    await page.getByLabel("Ends").fill("2027-06-30");
    await page.getByLabel(/Target pages/).fill("1000");
    await page.getByRole("button", { name: "Propose project" }).click();
    await expect(page.getByRole("heading", { name: "Regional periodicals grant" })).toBeVisible();
  });

  step(2, "add two colleagues and a group", async () => {
    await page.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Add a person…" }).click();
    await page.getByRole("option", { name: "Jana Nováková" }).click();
    await dialog.getByRole("combobox", { name: "Add a person…" }).click();
    await page.getByRole("option", { name: "Eva Horáková" }).click();
    await dialog.getByRole("combobox", { name: "Add a group…" }).click();
    await page.getByRole("option", { name: "Periodicals Curators" }).click();
    await dialog.getByRole("button", { name: "Save members" }).click();
    await expect(page.getByText(/Periodicals Curators/)).toBeVisible();
  });

  step(3, "approve Martin's proposed project at High priority", async () => {
    await page.getByRole("link", { name: "Back to Projects" }).click();
    await page.getByRole("link", { name: "Hudebniny — NAKI III" }).click();
    await page.getByRole("main").getByRole("button", { name: "Approve…" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Priority" }).click();
    await page.getByRole("option", { name: "High" }).click();
    await dialog.getByRole("button", { name: /Approve/ }).click();
    await expect(page.getByRole("heading", { name: "Hudebniny — NAKI III" })).toBeVisible();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("High", { exact: true }).first()).toBeVisible();
  });

  step(4, "Martin extends the approved project's end date", async () => {
    page = await as("dig-curator");
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("link", { name: "Hudebniny — NAKI III" }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Ends").fill("2029-12-31");
    await expect(dialog.getByText("Its intention counts over the new dates:")).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("endsOn: 2028-08-31 → 2029-12-31", { exact: true })).toBeVisible();
  });
});
