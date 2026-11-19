import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  request,
  test,
} from "@playwright/test";

type Role = "reader" | "staff" | "curator" | "dig-curator" | "admin";
type Step = ((n: number, title: string, fn: () => Promise<void>) => void) & {
  fixme: (n: number, title: string, mismatch: string, fn?: () => Promise<void>) => void;
};
type JourneyBody = (tools: {
  step: Step;
  as: (role: Role) => Promise<Page>;
  api: (role: Role) => Promise<APIRequestContext>;
  clock: (
    input: { at: string } | { advance: { days?: number; hours?: number; minutes?: number } },
  ) => Promise<string>;
  outbox: () => Promise<unknown>;
}) => void;

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
  const apis = new Map<Role, APIRequestContext>();
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
      await Promise.all([
        ...[...contexts.values()].map((context) => context.close()),
        ...[...apis.values()].map((context) => context.dispose()),
      ]);
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

    const api = async (role: Role): Promise<APIRequestContext> => {
      const existing = apis.get(role);
      if (existing) return existing;
      await as(role);
      const cookie = (await pages.get(role)?.context().cookies(baseURL))?.find(
        (entry) => entry.name === "vera_session",
      )?.value;
      if (!cookie) throw new Error(`Session for ${role} has no vera_session cookie`);
      const context = await request.newContext({
        baseURL,
        extraHTTPHeaders: { Cookie: `vera_session=${cookie}` },
      });
      apis.set(role, context);
      return context;
    };

    const clock = async (
      input: { at: string } | { advance: { days?: number; hours?: number; minutes?: number } },
    ): Promise<string> => {
      const response = await fetch(`${backend}/_engine/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`Clock failed (${response.status}): ${await response.text()}`);
      }
      const result = (await response.json()) as { now: string };
      await Promise.all([...pages.values()].map((page) => page.clock.setFixedTime(result.now)));
      return result.now;
    };

    const outbox = async (): Promise<unknown> => {
      const response = await fetch(`${backend}/_engine/outbox`);
      if (!response.ok) {
        throw new Error(`Outbox failed (${response.status}): ${await response.text()}`);
      }
      return response.json();
    };

    body({ step, as, api, clock, outbox });
  });
}

export { expect };
