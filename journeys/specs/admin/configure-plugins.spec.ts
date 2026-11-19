import { expect, journey } from "../../src/journey.ts";

journey("admin/configure-plugins", ({ step, as }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "read the new catalog-validity version", async () => {
    page = await as("admin");
    await page.goto("/plugins");
    await page.getByRole("row").filter({ hasText: "MarcComparator" }).click();
    await page.getByRole("button", { name: /Upload a new version/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Package")
      .setInputFiles("../backend/testing/build/plugin-packages/catalog-validity-3.2.0.jar");
    await dialog.getByRole("button", { name: "Read it" }).click();
    await expect(dialog.getByRole("button", { name: "Install v3.2.0" })).toBeEnabled();
    await expect(dialog.getByText(/adds/i)).toBeVisible();
    await expect(dialog.getByText(/retires/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Install/ })).toBeEnabled();
    await dialog.getByRole("button", { name: /Install/ }).click();
    await expect(page.getByRole("row").filter({ hasText: "MarcComparator" })).toContainText(
      "v3.2.0",
    );
  });

  step(2, "move the ruleset to the new version", async () => {
    await page.goto("/plugins");
    await page.getByRole("row").filter({ hasText: "Default ruleset" }).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: /Move to v3\.2\.0/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /Move Default ruleset to v3\.2\.0/ }),
    ).toBeVisible();
    await expect(dialog.getByText(/adds/i)).toBeVisible();
    await expect(dialog.getByText(/retires/i)).toBeVisible();
    await dialog.getByRole("button", { name: /Move to v3\.2\.0/ }).click();
    await expect(
      dialog.getByRole("heading", { name: /Move Default ruleset to v3\.2\.0/ }),
    ).toHaveCount(0);
    await expect(dialog.getByText("Default ruleset runs v3.2.0:")).toBeVisible();
    await expect(dialog.getByText("v3.2.0", { exact: true })).toBeVisible();
  });

  step(3, "keep the catalog secret when editing", async () => {
    await page.goto("/plugins");
    await page.getByRole("row").filter({ hasText: "HttpWebhook" }).click();
    const implementation = page.getByRole("dialog", { name: "HttpWebhook" });
    await implementation.getByRole("button", { name: "New instance…" }).click();
    const create = page.getByRole("dialog");
    await expect(create).toContainText("HttpWebhook");
    await create.getByLabel("Name").fill("Archive sync webhook");
    await create.getByLabel("timeout").fill("10s");
    await create.getByLabel("sign").fill("hmac-sha256");
    await create.getByLabel("secret").fill("journey-secret");
    await create.getByRole("button", { name: "Create instance" }).click();
    await expect(create.getByRole("heading", { name: "New instance of HttpWebhook" })).toHaveCount(
      0,
    );

    const instance = page.getByRole("dialog", { name: "Archive sync webhook" });
    await expect(instance).toBeVisible();
    await instance.getByRole("button", { name: "Edit configuration…" }).click();
    const edit = page.getByRole("dialog", { name: "Edit Archive sync webhook" });
    const secret = edit.getByLabel("secret");
    await expect(secret).toHaveAttribute("placeholder", /set: leave blank to keep it/);
    await secret.fill("");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit.getByRole("heading", { name: "Edit Archive sync webhook" })).toHaveCount(0);
    await expect(instance.locator("pre")).toContainText("secret = •••");
  });

  step(4, "show the impact of disabling an identity", async () => {
    await page.goto("/plugins");
    await page.getByRole("row", { name: /^Instance Google/ }).click();
    await page.getByRole("button", { name: "Disable…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/1 person signs in through it/)).toBeVisible();
    await dialog.getByRole("button", { name: "Disable…" }).click();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
  });

  step(5, "refuse to disable the last identity", async () => {
    await page.goto("/plugins");
    for (const identity of ["Seznam", "Local accounts"]) {
      await page.getByRole("row", { name: new RegExp(`^Instance ${identity}`) }).click();
      await page.getByRole("button", { name: "Disable…" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Disable…" }).click();
      await expect(dialog.getByText(`${identity} disabled:`)).toBeVisible();
    }
    await page.getByRole("row", { name: /^Instance MZK Keycloak/ }).click();
    await page.getByRole("button", { name: "Disable…" }).click();
    const last = page.getByRole("dialog");
    await last.getByRole("button", { name: "Disable…" }).click();
    await expect(last.getByRole("alert")).toHaveText(
      "It is the last way to log in; enable another first.",
    );
  });

  step(6, "run a harvester and find its task", async () => {
    await page.goto("/plugins");
    await page.getByRole("row").filter({ hasText: "Moravian periodicals" }).click();
    await page.getByRole("button", { name: "Run now" }).click();
    await expect(
      page.getByRole("link", { name: /Moravian periodicals — run by hand/ }),
    ).toBeVisible();
    await page.goto("/tasks");
    await expect(
      page.getByRole("button", { name: "Moravian periodicals — run by hand" }),
    ).toBeVisible();
  });
});
