import { expect, journey } from "../../src/journey.ts";

journey("curator/decide-proposals", ({ step, as }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "show proposals in Periodicals custody", async () => {
    page = await as("curator");
    await page.getByRole("link", { name: "Requests" }).click();
    await expect(page.getByRole("button", { name: /Periodicals Ostravský deník/ })).toBeVisible();
    await expect(page.getByText("Moravica", { exact: true })).toHaveCount(0);
  });

  step(2, "approve both asks into one iteration", async () => {
    await page.getByRole("button", { name: /Národní listy/ }).click();
    await expect(page.getByText("Decide for all 4")).toBeVisible();
    await expect(page.getByLabel("Category")).toBeVisible();
    await page.getByRole("button", { name: "Approve for all 4" }).click();
    await expect(page.getByText(/Decided: Approved/)).toBeVisible();
  });

  step(3, "wait for checks before deciding", async () => {
    await page.getByRole("button", { name: /Ostravský deník/ }).click();
    await expect(page.getByText("Checks still running")).toBeVisible();
  });

  step(4, "require a reason for a rescan", async () => {
    await page.getByRole("button", { name: /Brněnský kalendář.*Kramerius: Published/ }).click();
    await expect(page.getByRole("textbox", { name: /Why scan it again/ })).toBeVisible();
  });

  step(5, "decline with public and internal text", async () => {
    await page
      .getByRole("button", { name: /Hlídka/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Decline…", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What they are told").fill("This item is not in scope.");
    await dialog.getByLabel("Internal note").fill("Reviewed with the collections team.");
    const decline = dialog.getByRole("button", { name: "Decline", exact: true });
    await expect(decline).toBeEnabled();
    await decline.click();
    await expect(page.getByText(/They were told: “This item is not in scope\.”/)).toBeVisible();
    await expect(
      page.getByText("Reviewed with the collections team.", { exact: true }),
    ).toBeVisible();
  });

  step(6, "review a batch", async () => {
    await page.getByRole("combobox", { name: "Group the list" }).click();
    await page.getByRole("option", { name: "Group by batch" }).click();
    await expect(page.getByRole("button", { name: /Moravská orlice/ }).first()).toBeVisible();
  });

  step(7, "open a Moravica proposal without a decision", async () => {
    await page.goto("/requests?id=D22");
    await expect(page.getByText("This request is no longer within your reach")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve…", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Decline…", exact: true })).toHaveCount(0);
  });
});
