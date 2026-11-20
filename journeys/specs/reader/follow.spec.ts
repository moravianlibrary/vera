import { expect, journey } from "../../src/journey.ts";

journey("reader/follow", ({ step, as, api, clock }) => {
  let page: Awaited<ReturnType<typeof as>>;
  let listId = "";

  step(1, "show public statuses", async () => {
    // The base seed has no ask of Tomáš's on a running list, so the journey puts one there.
    const lists = await api("dig-curator");
    const created = await lists.post("/api/digitization-lists", {
      data: {
        name: "Tomáš's journey list",
        startsOn: "2026-06-25",
        endsOn: "2026-07-02",
        targetPages: 1,
        memberIds: ["IT4"],
      },
    });
    if (created.status() !== 201) {
      throw new Error(
        `Creating Tomáš's list failed (${created.status()}): ${await created.text()}`,
      );
    }
    const detail = (await created.json()) as { row: { list: { id: string } } };
    listId = detail.row.list.id;
    page = await as("reader");
    await expect(page.getByText("Waiting for review").first()).toBeVisible();
    await expect(page.getByText("Not accepted").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Kniha o Brně/ })).toContainText("Scheduled");
    await expect(page.getByText("Available").first()).toBeVisible();
    await expect(page.getByText("duplicate", { exact: true })).toHaveCount(0);
  });

  step(2, "read only the public reason", async () => {
    await page.getByRole("button", { name: /1901 Brněnský kalendář/ }).click();
    await expect(
      page.getByText(
        "Not accepted: This almanac is already being digitized by the Brno City Archives.",
      ),
    ).toBeVisible();
  });

  step(3, "open the published scan", async () => {
    await page.getByRole("button", { name: /Moravské hory a doly/ }).click();
    await expect(page.getByRole("link", { name: /Read it in/ })).toBeVisible();
  });

  step(4, "save a Scheduled watchlist", async () => {
    await page.getByRole("button", { name: "Status: any" }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Scheduled/ }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Current search" }).click();
    await page.getByLabel("Watchlist name").fill("Scheduled asks");
    await page.getByRole("button", { name: "Save new watchlist" }).click();
    await expect(page.getByRole("button", { name: /Scheduled asks 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ready to read/ })).toBeVisible();
    await page.getByRole("button", { name: "Status: Scheduled" }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Scheduled/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Status: any" })).toBeVisible();
  });

  step(5, "see a newly published ask", async () => {
    const listEditor = await api("dig-curator");
    const done = await listEditor.post(`/api/digitization-lists/${listId}/done`, { data: {} });
    if (!done.ok()) {
      throw new Error(
        `Marking list ${listId} Done failed (${done.status()}): ${await done.text()}`,
      );
    }
    const publisher = await api("admin");
    const published = await publisher.post("/api/iterations/IT4/publish", {
      data: { link: "https://www.digitalniknihovna.cz/mzk/uuid/it4" },
    });
    if (!published.ok()) {
      throw new Error(`Publishing IT4 failed (${published.status()}): ${await published.text()}`);
    }
    await clock({ advance: { minutes: 1 } });
    await page.reload();
    await page.getByRole("button", { name: "Expand navigation" }).click();
    const documents = page.getByRole("link", { name: /My Documents/ });
    await expect(documents).toHaveAccessibleName(/1 watchlist with new items/);
    await page.getByRole("button", { name: /^Ready to read/ }).click();
    await expect(page.getByRole("button", { name: /Kniha o Brně/ })).toBeVisible();
    await expect(documents).not.toHaveAccessibleName(/with new items/);
  });

  step(6, "withdraw the waiting ask", async () => {
    // Start from My Documents with no filter, whatever the earlier steps left in the URL.
    await page.goto("/my-documents");
    await expect(page.getByRole("button", { name: "Status: any" })).toBeVisible();
    await page.getByRole("button", { name: /MZK01-001622010.*Národní listy/ }).click();
    await page.getByRole("button", { name: "Withdraw…" }).click();
    await page.getByRole("button", { name: "Withdraw" }).click();
    await expect(
      page
        .getByRole("complementary", { name: "Národní listy" })
        .getByText("Withdrawn", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
  });
});
