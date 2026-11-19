import { expect, journey } from "../../src/journey.ts";

journey("admin/manage-access", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "find Adam with no access", async () => {
    page = await as("admin");
    await page.goto("/access");
    await expect(page.getByRole("heading", { name: "Users management" })).toBeVisible();
    await page.getByRole("row").filter({ hasText: "Adam Kolář" }).click();
    await expect(
      page.getByText(/No access yet: They logged in through Local accounts/),
    ).toBeVisible();
  });

  step(2, "give Adam staff and group access", async () => {
    await page.getByRole("button", { name: "Roles…" }).click();
    await page.getByRole("checkbox", { name: "staff" }).check();
    await page.getByRole("button", { name: "Save" }).click();
    await page
      .getByRole("complementary", { name: "Adam Kolář" })
      .getByRole("button", { name: "More", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Groups…" }).click();
    await page.getByRole("checkbox", { name: "Periodicals Curators" }).check();
    await page.getByRole("button", { name: "Save" }).click();
    const record = page.getByRole("region", { name: "Adam Kolář" });
    await expect(record).toContainText("staff");
    await expect(record).toContainText("by hand");
    await expect(record).toContainText("Periodicals Curators");
  });

  step(3, "create a local reader account", async () => {
    await page.getByRole("button", { name: "New local account" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("External expert");
    await dialog.getByLabel("Email").fill("expert@example.org");
    await dialog.getByLabel("Username").fill("external.expert");
    await expect(dialog.getByRole("checkbox", { name: /^reader/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "External expert", exact: true })).toBeVisible();
  });

  step(4, "link a Keycloak identity", async () => {
    await page.goto("/access");
    await page.getByRole("row").filter({ hasText: "Adam Kolář" }).click();
    const record = page.getByRole("complementary", { name: "Adam Kolář" });
    await record.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Link identity…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: /MZK Keycloak/ }).click();
    await dialog.getByLabel("Their id there").fill("adam.kolar.external");
    await dialog.getByRole("button", { name: /Link/ }).click();
    await expect(page.getByText(/MZK Keycloak.*adam.kolar.external/)).toBeVisible();
  });

  step(5, "refuse an invalid curator permission scope", async () => {
    await page.goto("/access?view=roles");
    await page
      .getByRole("row")
      .filter({ hasText: /^curator/ })
      .click();
    const role = page.getByRole("complementary", { name: "curator" });
    await role.getByRole("button", { name: "Edit grants…" }).click();
    const dialog = page.getByRole("dialog");
    const decisionScope = dialog.getByRole("combobox", { name: /request\.decide/ });
    await decisionScope.click();
    await expect(page.getByRole("option", { name: "in custody", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "all", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "in projects", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  step(6, "refuse to remove the last access manager", async () => {
    await page.goto("/access?view=roles");
    await page
      .getByRole("row")
      .filter({ hasText: /^admin/ })
      .click();
    await page
      .getByRole("complementary", { name: "admin" })
      .getByRole("button", { name: "Edit grants…" })
      .click();
    const dialog = page.getByRole("dialog");
    const accessGrant = dialog.getByRole("combobox", { name: "access.manage" });
    await accessGrant.click();
    await page.getByRole("option", { name: "—", exact: true }).click();
    await expect(dialog.getByText(/Nobody else could manage access after this/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save role" })).toBeDisabled();
  });

  step(7, "review custody impact before deleting", async () => {
    await page.goto("/access?view=custodies");
    await page.getByRole("row").filter({ hasText: "19th-century prints" }).click();
    const custody = page.getByRole("complementary", { name: "19th-century prints" });
    await custody.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/5 open proposals in it lose this custody/)).toBeVisible();
    const impactResponse = await (await api("admin")).get("/api/access/custodies/pc2/impact");
    expect(impactResponse.ok()).toBeTruthy();
    const impact = (await impactResponse.json()) as {
      openCount: number;
      toFallbackCount: number;
      ruleIds: string[];
    };
    expect(impact).toMatchObject({ openCount: 5, toFallbackCount: 0, ruleIds: ["pi34"] });
    await expect(dialog.getByText(/in no other custody and land in the Fallback/)).toHaveCount(0);
    await expect(
      dialog.getByText(
        /Printed 1800–1899 still returns 19th-century prints: it shows a warning on Plugins until it is changed\./,
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Delete custody" }).click();
    await expect(
      page.getByRole("region", { name: "Items" }).getByText(/19th-century prints deleted/),
    ).toBeVisible();
    await page.goto("/plugins");
    await expect(page.getByRole("row").filter({ hasText: "Printed 1800–1899" })).toContainText(
      "Its custody was deleted: it places nothing",
    );
  });

  step(8, "refuse to delete the fallback custody", async () => {
    await page.goto("/access?view=custodies");
    await page.getByRole("row").filter({ hasText: "Fallback" }).click();
    const fallback = page.getByRole("complementary", { name: "Fallback" });
    await expect(fallback.getByText(/It cannot be deleted/)).toBeVisible();
    await expect(fallback.getByRole("button", { name: "Delete…" })).toHaveCount(0);
  });
});
