import { readdirSync, writeFileSync } from "node:fs";
import { setupServer } from "msw/node";
import type { MockUserProfile } from "@/config/env";
import { env } from "@/config/env";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";
import { mask } from "../../replay/src/mask";

type Call = {
  as?: MockUserProfile;
  method: string;
  path: string;
  requestBody?: unknown;
  acceptLanguage?: "cs" | "en";
  form?: Record<string, string | { photoBytes: number; fileName?: string }>;
  compare: "body" | "code";
};
type List = {
  seed: string;
  moment: string;
  mask: "none" | "decisions" | "proposals";
  scenarios: Array<{ name: string; calls: Call[] }>;
};

const profileByUser: Record<string, MockUserProfile> = {
  u3: "admin",
  u8: "curator",
  u2: "digitization",
  u4: "staff",
  u5: "reader",
  u10: "no-access",
  u9: "project-user",
};
const userByProfile = Object.fromEntries(
  Object.entries(profileByUser).map(([id, profile]) => [profile, id]),
);
// Bun has no location for MSW to resolve a relative route, so the recorder supplies an absolute API base.
const apiBase = env.VITE_API_BASE_URL;
if (!/^https?:\/\//.test(apiBase))
  throw new Error(`VITE_API_BASE_URL must be an absolute URL; received "${apiBase}"`);
const parsedApiBase = new URL(apiBase);
if (parsedApiBase.origin === "null")
  throw new Error(`VITE_API_BASE_URL must be an absolute URL; received "${apiBase}"`);
const names = readdirSync(new URL("./lists/", import.meta.url))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -3))
  .toSorted();
const selected = process.argv.slice(2);
const listNames = selected.length === 0 ? names : selected;
const NativeDate = Date;
const server = setupServer();
const initial = structuredClone(database);
const recorderSessionItems = new Map<string, string>();
if (typeof globalThis.window === "undefined") {
  // The mock's session handlers use sessionStorage; recording needs it without a browser.
  const sessionStorage = {
    getItem: (key: string) => recorderSessionItems.get(key) ?? null,
    setItem: (key: string, value: string) => recorderSessionItems.set(key, String(value)),
    removeItem: (key: string) => recorderSessionItems.delete(key),
    clear: () => recorderSessionItems.clear(),
    key: (index: number) => [...recorderSessionItems.keys()][index] ?? null,
    get length() {
      return recorderSessionItems.size;
    },
  } as Storage;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });
}

function restoreMock() {
  recorderSessionItems.clear();
  for (const key of Object.keys(initial) as Array<keyof typeof database>) {
    const current = database[key];
    const saved = structuredClone(initial[key]);
    if (Array.isArray(current)) current.splice(0, current.length, ...(saved as never[]));
    else (database as Record<string, unknown>)[key] = saved;
  }
}

function setMoment(moment: string) {
  const frozen = new NativeDate(moment).getTime();
  class FrozenDate extends NativeDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      super(...((args.length === 0 ? [frozen] : args) as [number]));
    }
    static now() {
      return frozen;
    }
  }
  globalThis.Date = FrozenDate;
}

async function send(call: Call, path: string): Promise<Response> {
  server.resetHandlers();
  if (call.as !== undefined) server.use(...createHandlers(call.as));
  else server.use(...createHandlers("reader"));
  const headers = new Headers();
  headers.set("Accept-Language", call.acceptLanguage ?? "en");
  let body: BodyInit | undefined;
  if (call.form !== undefined) {
    const form = new FormData();
    for (const [key, value] of Object.entries(call.form)) {
      if (typeof value === "string") form.append(key, value);
      else
        form.append(
          key,
          new File([new Uint8Array(value.photoBytes)], value.fileName ?? "photo.jpg"),
        );
    }
    body = form;
  } else if (call.requestBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(call.requestBody);
  }
  const requestPath = path.startsWith("/api") ? path.slice("/api".length) : path;
  const url = `${parsedApiBase.origin}${parsedApiBase.pathname.replace(/\/$/, "")}${requestPath}`;
  return fetch(url, { method: call.method, headers, body });
}

async function record(list: List, name: string) {
  const scenarios = [];
  for (const scenario of list.scenarios) {
    restoreMock();
    setMoment(list.moment);
    const initialDocumentIds = new Set(database.documents.map(({ id }) => id));
    const ids = new Map<string, string>();
    const calls = [];
    for (const input of scenario.calls) {
      let path = input.path;
      if (path.includes("$NEW_DOCUMENT")) {
        const created = database.documents.find(({ id }) => !initialDocumentIds.has(id));
        if (created === undefined)
          throw new Error(`${scenario.name}: no newly written document for $NEW_DOCUMENT`);
        path = path.replace("$NEW_DOCUMENT", encodeURIComponent(created.id));
      }
      const response = await send(input, path);
      const user = input.as === undefined ? undefined : (userByProfile[input.as] ?? input.as);
      const profileScenario = /^u\d+$/.test(scenario.name);
      const asFirst = name === "base-decisions" || (name === "base-proposals" && !profileScenario);
      const output: Record<string, unknown> = {
        ...(asFirst && user !== undefined ? { as: user } : {}),
        method: input.method,
        path: input.path,
        status: response.status,
      };
      if (asFirst && input.requestBody !== undefined) output.requestBody = input.requestBody;
      if (input.acceptLanguage !== undefined) output.acceptLanguage = input.acceptLanguage;
      if (response.status !== 204 && response.body !== null) {
        const contentType = response.headers
          .get("Content-Type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (contentType !== "application/json" && contentType !== "application/problem+json") {
          output.text = await response.text();
          if (contentType !== undefined) output.contentType = contentType;
        } else {
          const answer = (await response.json()) as unknown;
          if (input.compare === "code") output.code = (answer as { code?: string }).code;
          else output.body = list.mask === "none" ? answer : mask(answer, list.mask, ids);
        }
      }
      if (!asFirst) {
        if (input.requestBody !== undefined) output.requestBody = input.requestBody;
        if (input.acceptLanguage !== undefined) output.acceptLanguage = input.acceptLanguage;
        if (user !== undefined) output.as = user;
        if (input.form !== undefined) output.form = input.form;
      }
      if (asFirst && input.form !== undefined) output.form = input.form;
      calls.push(output);
    }
    scenarios.push({ name: scenario.name, calls });
  }
  globalThis.Date = NativeDate;
  return { seed: list.seed, moment: list.moment, scenarios, mask: list.mask };
}

server.listen({ onUnhandledRequest: "error" });
try {
  for (const name of listNames) {
    const list = (await import(`./lists/${name}.ts`)).default as List;
    const output = await record(list, name);
    const outputPath = `../replay/recordings/${name}.json`;
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(
      `${name}: ${output.scenarios.length} scenarios, ${output.scenarios.reduce((n, s) => n + s.calls.length, 0)} calls`,
    );
  }
} finally {
  globalThis.Date = NativeDate;
  server.close();
}
