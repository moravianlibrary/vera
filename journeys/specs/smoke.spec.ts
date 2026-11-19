import { expect, journey } from "../src/journey.ts";

journey("smoke", ({ step, as }) => {
  step(1, "the reader lands on My Documents", async () => {
    const page = await as("reader");
    await expect(page.getByRole("link", { name: "My Documents" })).toBeVisible();
  });

  step(2, "the admin sees Users & Groups", async () => {
    const page = await as("admin");
    await expect(page.getByRole("link", { name: "Users management" })).toBeVisible();
  });
});
