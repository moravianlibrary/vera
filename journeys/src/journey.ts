import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

type Role = "reader" | "staff" | "curator" | "dig-curator" | "admin";
type Step = ((n: number, title: string, fn: () => Promise<void>) => void) & {
  fixme: (n: number, title: string, mismatch: string, fn?: () => Promise<void>) => void;
};
type JourneyBody = (tools: { step: Step; as: (role: Role) => Promise<Page> }) => void;

const people: Record<Role, string> = {
  reader: "u5",
  staff: "u4",
  curator: "u8",
  "dig-curator": "u2",
  admin: "u3",
};
const backend = process.env.VERA_JOURNEYS_BACKEND ?? "http://127.0.0.1:8091";
const baseURL = process.env.VERA_JOURNEYS_URL ?? "http://127.0.0.1:5290";

function seedNow(seed: string): string {
  const file = JSON.parse(
    readFileSync(resolve(process.cwd(), "../seeds", `${seed}.json`), "utf8"),
  ) as {
    now?: string;
    extends?: string;
  };
  if (file.now) return file.now;
  if (file.extends) return seedNow(file.extends);
  throw new Error(`Seed ${seed} has no now or extends`);
}

export function journey(path: string, body: JourneyBody, options: { seed?: string } = {}): void {
  const seed = options.seed ?? "base";
  const contexts = new Map<Role, BrowserContext>();
  const pages = new Map<Role, Page>();
  let browser: Browser;

  test.describe(path, () => {
    test.describe.configure({ mode: "serial" });

    test.beforeAll(async ({ browser: browserFixture }) => {
      browser = browserFixture;
      const response = await fetch(`${backend}/_engine/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, frozen: true }),
      });
      if (!response.ok) {
        throw new Error(`Reset failed (${response.status}): ${await response.text()}`);
      }
    });

    test.afterAll(async () => {
      await Promise.all([...contexts.values()].map((context) => context.close()));
    });

    const as = async (role: Role): Promise<Page> => {
      const existing = pages.get(role);
      if (existing) return existing;
      const context = await browser.newContext({
        baseURL,
        locale: "en-US",
        timezoneId: "Europe/Prague",
      });
      contexts.set(role, context);
      const response = await fetch(`${backend}/_engine/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: people[role] }),
      });
      if (!response.ok) {
        throw new Error(
          `Session for ${role} failed (${response.status}): ${await response.text()}`,
        );
      }
      const cookie = response.headers.get("set-cookie")?.match(/vera_session=([^;]+)/)?.[1];
      if (!cookie) throw new Error(`Session for ${role} did not set vera_session`);
      await context.addCookies([{ name: "vera_session", value: cookie, url: baseURL }]);
      const page = await context.newPage();
      await page.clock.setFixedTime(seedNow(seed));
      await page.goto("/");
      pages.set(role, page);
      return page;
    };

    const step = ((n: number, title: string, fn: () => Promise<void>) => {
      test(`Step ${n}: ${title}`, fn);
    }) as Step;
    step.fixme = (n, title, mismatch, fn = async () => {}) => {
      test.fixme(`Step ${n}: ${title} — MISMATCH: ${mismatch}`, fn);
    };

    body({ step, as });
  });
}

export { expect };
