import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, journey } from "../../src/journey.ts";

type Seed = {
  collections: {
    documents: { catalogId: string; unit: { value: string } | null }[];
    requests: { documentId: string }[];
    users: { id: string; name: string; email: string }[];
  };
  fakes: {
    catalogRecords: {
      catalogId: string;
      title: string;
      type: string;
      units: string[] | null;
    }[];
    ingest: Record<string, { defects: { field: string }[] }>;
  };
};

const seed = JSON.parse(readFileSync(resolve(process.cwd(), "../seeds/base.json"), "utf8")) as Seed;
const faultyPeriodical = seed.fakes.catalogRecords.find(
  (record) =>
    record.type === "Periodical" &&
    record.units !== null &&
    (seed.fakes.ingest[record.catalogId]?.defects.length ?? 0) > 0,
);
if (!faultyPeriodical?.units) throw new Error("The seed has no periodical with an ingest defect");
const watchlistName = "Urgent periodicals review";
const recipient = seed.collections.users.find((user) => user.id === "u8")?.email;
if (!recipient) throw new Error("The seed has no email address for Kateřina");

journey("cross-role/watchlist-news", ({ step, as, api, clock, outbox, runJobs }) => {
  let petr: Awaited<ReturnType<typeof as>>;
  let katerina: Awaited<ReturnType<typeof as>>;
  let itemIndex = 0;

  const proposeAndApprove = async (priority = "Urgent") => {
    const unit = faultyPeriodical.units?.[itemIndex++];
    if (unit === undefined) throw new Error("The faulty periodical has too few untried volumes");
    const requester = await api("reader");
    const lookup = await requester.post("/api/proposals/lookup", {
      data: { items: [{ type: "catalogId", value: faultyPeriodical.catalogId, unit }] },
    });
    if (!lookup.ok()) throw new Error(`Looking up the periodical failed (${lookup.status()})`);
    const [answer] = (await lookup.json()) as { kind: string }[];
    if (answer?.kind !== "new") throw new Error(`The periodical volume ${unit} is not new`);
    const submitted = await requester.post("/api/proposals", {
      data: {
        items: [{ type: "catalogId", value: faultyPeriodical.catalogId, unit, reason: null }],
        reason: "For local history research.",
        projectId: null,
        batchName: null,
        approval: null,
        entrySourceId: null,
      },
    });
    if (submitted.status() !== 201) {
      throw new Error(
        `Submitting the periodical failed (${submitted.status()}): ${await submitted.text()}`,
      );
    }
    await runJobs();

    await petr.goto("/requests");
    await petr.reload();
    const row = petr.getByRole("button", {
      name: new RegExp(`${faultyPeriodical.catalogId}.*${unit}`),
    });
    await expect(row).toBeVisible();
    await row.click();
    await petr.getByLabel("Category").click();
    await petr.getByRole("option", { name: "Periodicals / Regional", exact: true }).click();
    await petr.getByLabel("Priority").click();
    await petr.getByRole("option", { name: priority, exact: true }).click();
    await petr.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(petr.getByText(/Decided: Approved/)).toBeVisible();
    await runJobs();
    return unit;
  };

  const mailToKaterina = (messages: unknown) =>
    (messages as { recipient?: string; channel?: string }[]).filter(
      (message) => message.channel === "mail" && message.recipient === recipient,
    );

  step(1, "share urgent validations with Periodicals Curators", async () => {
    katerina = await as("curator");
    // Read Kateřina's notification preference and clear a seeded global mail pause if present.
    const settingsApi = await api("curator");
    const settingsResponse = await settingsApi.get("/api/session/settings");
    if (!settingsResponse.ok()) {
      throw new Error(
        `Reading Kateřina's notification settings failed (${settingsResponse.status()})`,
      );
    }
    const settings = (await settingsResponse.json()) as {
      notifications?: { doNotSend?: boolean; [key: string]: unknown };
    };
    if (settings.notifications?.doNotSend) {
      const saved = await settingsApi.patch("/api/session/settings", {
        data: { notifications: { ...settings.notifications, doNotSend: false } },
      });
      if (!saved.ok()) throw new Error(`Clearing Kateřina's mail pause failed (${saved.status()})`);
    }

    petr = await as("admin");
    await petr.goto("/review/documents");
    await petr.getByRole("button", { name: "Review: any" }).click();
    await petr.getByRole("menuitemcheckbox", { name: /^Review needed/ }).click();
    await petr.keyboard.press("Escape");
    await petr.getByRole("button", { name: "Add filter" }).click();
    await petr.getByRole("menuitem", { name: "Priority" }).click();
    await petr.getByRole("menuitemcheckbox", { name: "Urgent" }).click();
    await petr.keyboard.press("Escape");
    await petr.getByRole("button", { name: "Current search" }).click();
    await petr.getByLabel("Watchlist name").fill(watchlistName);
    await petr.getByRole("radio", { name: /some groups and roles/i }).check();
    await petr.getByLabel(/Periodicals Curators/).check();
    await petr.getByRole("button", { name: "Save new watchlist" }).click();
    await expect(
      petr.getByRole("navigation", { name: "Watchlists" }).getByRole("button", {
        name: /^System watchlist Urgent periodicals review/,
      }),
    ).toBeVisible();

    await katerina.goto("/review/documents");
    await katerina.reload();
    await expect(
      katerina.getByRole("navigation", { name: "Watchlists" }).getByRole("button", {
        name: /^System watchlist Urgent periodicals review/,
      }),
    ).toBeVisible();
  });

  step(2, "Kateřina enables mail", async () => {
    await katerina.goto("/preferences/watchlists");
    const row = katerina.getByRole("row").filter({ hasText: watchlistName });
    await expect(row).toBeVisible();
    const delivery = row.getByRole("switch", {
      name: new RegExp(`${watchlistName} MZK SMTP notifications`),
    });
    await expect(delivery).toBeEnabled();
    await delivery.click();
    await expect(delivery).toBeChecked();
    await clock({ advance: { minutes: 16 } });
    expect(mailToKaterina(await outbox())).toHaveLength(0);
  });

  step(3, "notify once within fifteen minutes", async () => {
    await proposeAndApprove();
    await katerina.goto("/review/documents");
    await katerina.reload();
    const validations = katerina.getByRole("navigation", { name: "Watchlists" });
    const urgentTab = validations.getByRole("button", {
      name: /System watchlist Urgent periodicals review 1 \+1 new/,
    });
    await expect(urgentTab).toBeVisible();
    await clock({ advance: { minutes: 16 } });
    const messages = mailToKaterina(await outbox());
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages[0])).toMatch(/watchlist|Urgent periodicals review/i);
  });

  step(4, "opening the watchlist clears its badge", async () => {
    await proposeAndApprove();
    await katerina.goto("/review/documents");
    await katerina.reload();
    const validations = katerina.getByRole("navigation", { name: "Watchlists" });
    const urgentTab = validations.getByRole("button", {
      name: /^System watchlist Urgent periodicals review/,
    });
    await expect(urgentTab).toBeVisible();
    await clock({ advance: { minutes: 5 } });
    await katerina
      .getByRole("navigation", { name: "Watchlists" })
      .getByRole("button", { name: /^System watchlist Urgent/ })
      .click();
    await expect(urgentTab).not.toContainText("+2");
    const before = mailToKaterina(await outbox()).length;
    await clock({ advance: { minutes: 11 } });
    expect(mailToKaterina(await outbox())).toHaveLength(before);
  });

  step(5, "confirm the changed system filter", async () => {
    await petr.goto("/watchlists");
    const row = petr.getByRole("row").filter({ hasText: watchlistName });
    await row.getByRole("link", { name: watchlistName }).click();
    await petr.getByRole("button", { name: "Priority Urgent" }).click();
    await petr.getByRole("menuitemcheckbox", { name: "High" }).click();
    await petr.keyboard.press("Escape");
    await petr.getByRole("button", { name: "Current search" }).click();
    await petr.getByRole("combobox", { name: "Update an existing watchlist" }).click();
    await petr.getByRole("option", { name: watchlistName, exact: true }).click();
    await petr.getByRole("button", { name: "Update watchlist", exact: true }).click();

    await katerina.goto("/preferences/watchlists");
    await katerina.reload();
    const changed = katerina.getByRole("row").filter({ hasText: watchlistName });
    await expect(
      changed.getByRole("button", { name: "Review changed filter and resume" }),
    ).toBeVisible();
    await changed.getByRole("button", { name: "Review changed filter and resume" }).click();
    await expect(
      changed.getByRole("button", { name: "Review changed filter and resume" }),
    ).toHaveCount(0);
    await katerina.reload();
    await expect(
      katerina.getByRole("row").filter({ hasText: watchlistName }).getByRole("button", {
        name: "Review changed filter and resume",
      }),
    ).toHaveCount(0);
  });

  step(6, "turn off notifications", async () => {
    await katerina.goto("/preferences/notifications");
    const notificationsOff = katerina.getByRole("switch", { name: "Do not send notifications" });
    await notificationsOff.click();
    await expect(notificationsOff).toBeChecked();
    const before = mailToKaterina(await outbox()).length;
    await proposeAndApprove("High");
    await clock({ advance: { minutes: 16 } });
    expect(mailToKaterina(await outbox())).toHaveLength(before);
    await katerina.goto("/preferences/watchlists");
    const row = katerina.getByRole("row").filter({ hasText: watchlistName });
    await expect(
      row.getByRole("switch", { name: new RegExp(`${watchlistName} MZK SMTP notifications`) }),
    ).toBeChecked();
  });
});
