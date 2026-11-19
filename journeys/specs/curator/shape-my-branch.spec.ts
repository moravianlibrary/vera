import { expect, journey } from "../../src/journey.ts";

journey("curator/shape-my-branch", ({ step, as, api }) => {
  let page: Awaited<ReturnType<typeof as>>;

  step(1, "look for a way to add a child to Maps", async () => {
    page = await as("curator");
    await page.getByRole("link", { name: "Categories" }).click();
    await page.getByRole("treeitem", { name: /^Maps 3$/ }).click();
    await expect(page.getByRole("button", { name: "Refine…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Child category" })).toHaveCount(0);
  });

  step(2, "refine Maps into Historical", async () => {
    await page.getByRole("treeitem", { name: /^Maps 3$/ }).click();
    await page.getByRole("button", { name: "Refine…" }).click();
    await page.getByLabel("Name").fill("Historical");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /Refine and move/ }).click();
    await expect(page.getByText(/Moved 3 documents into Historical/)).toBeVisible();
  });

  step(3, "add Modern without a share", async () => {
    await page.getByRole("treeitem", { name: /Maps/ }).click();
    await page.getByRole("button", { name: "+ Child category" }).click();
    await page.getByLabel("Name").fill("Modern");
    await page.getByRole("button", { name: "Create" }).click();
    const modern = page.getByRole("treeitem", { name: /^Modern/ });
    await expect(modern).toBeVisible();
    const details = page.getByRole("complementary");
    await expect(details.getByText("Modern", { exact: true })).toBeVisible();
    await expect(
      details.getByText(
        "Created Modern: Under Maps, with no share in any mix yet, so its set is flagged until somebody gives it one.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  step(4, "grant custody to a colleague", async () => {
    const peopleResponse = await (await api("admin")).get("/api/users");
    const people = (await peopleResponse.json()) as { id: string; name: string; kind: string }[];
    const colleague = people.find((person) => person.name === "Jana Nováková");
    if (colleague === undefined) throw new Error("Jana Nováková is not in the user index");
    await page.getByRole("button", { name: "Grant custody…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Add a person…" }).click();
    await page.getByRole("option", { name: colleague.name, exact: true }).click();
    await dialog.getByRole("button", { name: "Save custody" }).click();
    await expect(page.getByText(colleague.name, { exact: true })).toBeVisible();
  });

  step(5, "look for the top level among Modern's destinations", async () => {
    await page.getByRole("treeitem", { name: /Modern/ }).click();
    await page.getByRole("button", { name: "Edit…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Under").click();
    await expect(page.getByRole("option", { name: "the top level", exact: true })).toHaveCount(0);
  });
});
