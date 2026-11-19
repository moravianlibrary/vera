import { expect, journey } from "../../src/journey.ts";

journey("digitization/build-a-list", ({ step, as, api, clock, outbox }) => {
  let page: Awaited<ReturnType<typeof as>>;
  let listId = "";
  let contestedMemberId = "";

  step(1, "the overdue list is flagged", async () => {
    page = await as("dig-curator");
    const planner = await api("dig-curator");
    const poolResponse = await planner.get("/api/digitization-lists/pool?limit=50");
    if (!poolResponse.ok()) {
      throw new Error(`Pool read failed (${poolResponse.status()}): ${await poolResponse.text()}`);
    }
    const pool = (await poolResponse.json()) as { items: { iteration: { id: string } }[] };
    const member = pool.items[0];
    if (member === undefined) throw new Error("No pool item is available for overdue list setup");
    const setup = await planner.post("/api/digitization-lists", {
      data: {
        name: "Overdue run for the journey",
        startsOn: "2026-06-01",
        endsOn: "2026-06-20",
        targetPages: 1200,
        memberIds: [member.iteration.id],
      },
    });
    if (setup.status() !== 201) {
      throw new Error(`Overdue list setup failed (${setup.status()}): ${await setup.text()}`);
    }
    const created = (await setup.json()) as { row: { list: { id: string } } };
    listId = created.row.list.id;
    await page.getByRole("link", { name: "Digitization Lists", exact: true }).click();
    const row = page.getByRole("button", { name: /Overdue run for the journey/ });
    await expect(row).toContainText("Overdue");
    await row.click();
  });

  step(2, "hold the impossible item with a message", async () => {
    const response = await (await api("dig-curator")).get(`/api/digitization-lists/${listId}`);
    if (!response.ok())
      throw new Error(`List read failed (${response.status()}): ${await response.text()}`);
    const detail = (await response.json()) as { members: { iteration: { id: string } }[] };
    const member = detail.members[0];
    if (member === undefined)
      throw new Error("The seeded list has no member to mark not digitizable");
    await page.getByRole("button", { name: "More actions" }).last().click();
    await page.getByRole("menuitem", { name: /Could not be digitized/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Message").fill("The original is too fragile to scan.");
    await dialog.getByRole("button", { name: "Mark it" }).click();
    await expect(page.getByText("The original is too fragile to scan.")).toBeVisible();
  });

  step(3, "mark the list Done after its impact", async () => {
    await page.getByRole("button", { name: /Mark Done/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/move to Digitized/)).toBeVisible();
    await dialog.getByRole("button", { name: /Mark Done/ }).click();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();
  });

  step(4, "make a Monday list from A4 items", async () => {
    await page.getByRole("link", { name: "Digitization Lists", exact: true }).click();
    await page.getByRole("link", { name: "New list", exact: true }).click();
    await page.getByLabel("Name").fill("Monday scanning");
    await page.getByLabel("When it starts").click();
    await page.getByRole("option", { name: "Starts on", exact: true }).click();
    await page.getByLabel("Starts on").fill("2026-06-29");
    await page.getByLabel("Ends").fill("2026-07-03");
    await page.getByLabel("Target pages").fill("1200");
    await expect(page.getByText("Ready to list", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Size", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: /^A4/ }).click();
    await page.keyboard.press("Escape");
    const available = page.getByRole("region", { name: "Ready to list" });
    await expect(available.getByText("A4", { exact: true }).first()).toBeVisible();
    const checkbox = available.getByRole("checkbox").first();
    contestedMemberId = (await checkbox.getAttribute("aria-label"))?.replace("Pick ", "") ?? "";
    expect(contestedMemberId).not.toBe("");
    await checkbox.check();
    await available.getByRole("button", { name: /Add 1$/ }).click();
    await expect(
      page.getByRole("region", { name: "On this list" }).getByRole("checkbox"),
    ).toHaveCount(1);
  });

  step(5, "refuse an item taken by another list", async () => {
    const admin = await api("admin");
    const taken = await admin.post("/api/digitization-lists", {
      data: {
        name: "Concurrent Monday list",
        startsOn: "2026-06-29",
        endsOn: "2026-07-03",
        targetPages: 1200,
        memberIds: [contestedMemberId],
      },
    });
    if (taken.status() !== 201) {
      throw new Error(`Concurrent list setup failed (${taken.status()}): ${await taken.text()}`);
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Something you put on it is no longer ready to list."),
    ).toBeVisible();
  });

  step(6, "take the blocked item off the other list", async () => {
    page = await as("dig-curator");
    await expect(page.getByRole("button", { name: "User menu" })).toContainText("Martin Svoboda");
    await page.getByRole("link", { name: "Digitization Lists", exact: true }).click();
    const leave = page.getByRole("alertdialog");
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Digitization Lists" })).toBeVisible();
    await page.getByRole("button", { name: /State: any/ }).click();
    await page.getByRole("menuitemcheckbox", { name: /Planned/ }).click();
    await page.keyboard.press("Escape");
    const future = page.getByRole("button", { name: /Regional weeklies/ });
    await expect(future).toBeVisible();
    await future.click();
    await expect(page.getByText(/Blocked since listing/)).toBeVisible();
    const detailResponse = await (await api("dig-curator")).get(
      "/api/digitization-lists/L-2026-015",
    );
    if (!detailResponse.ok()) {
      throw new Error(
        `Future list read failed (${detailResponse.status()}): ${await detailResponse.text()}`,
      );
    }
    const detail = (await detailResponse.json()) as {
      members: { iteration: { id: string }; document: { id: string }; blocker: string | null }[];
    };
    const blocked = detail.members.find((item) => item.blocker !== null);
    if (blocked === undefined) throw new Error("Regional weeklies has no blocked member");
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("region", { name: "On this list" });
    await editor.getByRole("checkbox", { name: new RegExp(blocked.iteration.id) }).check();
    await editor.getByRole("button", { name: /Take off 1/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/lists\?/);
    await page.goto(`/documents?id=${encodeURIComponent(blocked.document.id)}`);
    await expect(page.getByText("Being added", { exact: true })).toBeVisible();
  });

  step(7, "delete the mistaken planned list", async () => {
    await page.getByRole("link", { name: "Digitization Lists", exact: true }).click();
    await page.getByRole("link", { name: "New list", exact: true }).click();
    await page.getByLabel("Name").fill("Mistaken plan");
    await page.getByLabel("Ends").fill("2026-06-30");
    await expect(page.getByText("Ready to list", { exact: true })).toBeVisible();
    const available = page.getByRole("region", { name: "Ready to list" });
    const picks = available.getByRole("checkbox");
    const pickedIds: string[] = [];
    for (const pick of await picks.all().then((all) => all.slice(0, 2))) {
      const label = (await pick.getAttribute("aria-label")) ?? "";
      const id = label.replace("Pick ", "");
      if (id !== "") {
        pickedIds.push(id);
        await pick.check();
      }
    }
    expect(pickedIds.length).toBeGreaterThan(0);
    await available.getByRole("button", { name: new RegExp(`Add ${pickedIds.length}$`) }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/lists\?id=/);
    const savedListId = new URL(page.url()).searchParams.get("id");
    if (savedListId === null) throw new Error("Saved list has no id in its URL");
    const saved = await (await api("dig-curator")).get(`/api/digitization-lists/${savedListId}`);
    if (!saved.ok()) throw new Error(`List read failed (${saved.status()}): ${await saved.text()}`);
    const savedDetail = (await saved.json()) as {
      members: { iteration: { id: string }; document: { id: string } }[];
    };
    const picked = pickedIds.map((id) => {
      const item = savedDetail.members.find(({ iteration }) => iteration.id === id);
      if (item === undefined) throw new Error(`Saved list is missing member ${id}`);
      return { id, documentId: item.document.id };
    });
    await page.getByRole("button", { name: /Mistaken plan/ }).click();
    await page.getByRole("button", { name: "More", exact: true }).first().click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await expect(page.getByRole("dialog").getByText(/return to the pool/)).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Delete list/ })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const firstMember = picked[0];
    if (firstMember === undefined) throw new Error("Mistaken plan has no member to inspect");
    await page.goto(`/documents?id=${encodeURIComponent(firstMember.documentId)}`);
    await expect(page.getByText("History", { exact: true })).toBeVisible();
    await expect(page.getByText("Mistaken plan · list deleted", { exact: true })).toBeVisible();
  });

  // Run last because advancing the seeded 60-minute hook window expires the curator session.
  step(4, "the list.created hook fires", async () => {
    await clock({ advance: { minutes: 61 } });
    expect(JSON.stringify(await outbox())).toContain("list.created");
  });
});
