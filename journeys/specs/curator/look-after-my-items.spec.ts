import { expect, journey } from "../../src/journey.ts";

journey("curator/look-after-my-items", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;
  let listId = "";

  step(1, "reclassify a ready item", async () => {
    page = await as("curator");
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: /Moravské noviny/ }).click();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /Reclassify/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Category").click();
    await page.getByRole("option", { name: "Periodicals / Specialist", exact: true }).click();
    await dialog.getByLabel("Priority").click();
    await page.getByRole("option", { name: "Normal", exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Reclassified", { exact: true })).toBeVisible();
  });

  step(2, "cancel an item on a running list", async () => {
    // L-2026-014 is the running Periodicals list in the base seed.
    listId = "L-2026-014";
    await page.reload();
    await expect(page.getByRole("button", { name: /Hlas Moravy/ })).toBeVisible();
    await page.getByRole("button", { name: /Hlas Moravy/ }).click();
    await page.getByRole("button", { name: "More" }).click();
    const cancel = page.getByRole("menuitem", { name: /Cancel/ });
    await expect(cancel).toBeVisible();
    await cancel.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("We need to pause this item.");
    await dialog.getByLabel("Internal note").fill("Revisit after the schedule changes.");
    await dialog.getByRole("button", { name: "Cancel it", exact: true }).click();
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  });

  step(3, "publish a digitized item", async () => {
    const planner = await api("dig-curator");
    const done = await planner.post(`/api/digitization-lists/${listId}/done`, { data: {} });
    if (!done.ok()) {
      throw new Error(
        `Marking list ${listId} Done failed (${done.status()}): ${await done.text()}`,
      );
    }

    await page.reload();
    await page.getByRole("button", { name: /Hanák/ }).click();
    await expect(page.getByRole("button", { name: /Hanák/ }).first()).toContainText("Digitized");
    await page.getByRole("button", { name: "More" }).click();
    const addLink = page.getByRole("menuitem", { name: /Add link/ });
    await expect(addLink).toBeVisible();
    await addLink.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Link")
      .fill("https://www.digitalniknihovna.cz/mzk/uuid/periodicals-journey");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /Hanák/ }).first()).toContainText("Published");

    page = await as("staff");
    await page.getByRole("link", { name: "My Documents" }).click();
    await expect(page.getByRole("button", { name: /Hanák/ })).toContainText("Available");
  });

  step(4, "resume the cancelled item", async () => {
    page = await as("curator");
    await page.getByRole("button", { name: /Hlas Moravy/ }).click();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /Resume/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Resume/ })
      .click();
    await expect(page.getByRole("button", { name: /Hlas Moravy/ }).first()).toContainText("Ready");
  });
});
