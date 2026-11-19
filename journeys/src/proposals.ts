import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";

export type Item = { type: "catalogId"; value: string; unit: string | null };
export type RoleLimits = { proposalBatchLimit: number; proposalDailyLimit: number };

type Seed = {
  fakes: { catalogRecords: { catalogId: string; units: string[] | null }[] };
  collections: { documents: { catalogId: string; unit: { value: string } | null }[] };
};

export function limitsFor(role: "reader" | "staff"): RoleLimits {
  const seed = JSON.parse(
    readFileSync(resolve(process.cwd(), "../seeds/installation.json"), "utf8"),
  ) as { collections: { roles: (RoleLimits & { id: string })[] } };
  const limits = seed.collections.roles.find((entry) => entry.id === role);
  if (limits === undefined) throw new Error(`No limits for ${role} in the installation seed`);
  return limits;
}

export function seedItems(): Item[] {
  const seed = JSON.parse(
    readFileSync(resolve(process.cwd(), "../seeds/base.json"), "utf8"),
  ) as Seed;
  const known = new Set(seed.fakes.catalogRecords.map(({ catalogId }) => catalogId));
  const items = seed.fakes.catalogRecords.flatMap<Item>(({ catalogId, units }) =>
    units === null
      ? [{ type: "catalogId" as const, value: catalogId, unit: null }]
      : units.map((unit) => ({ type: "catalogId" as const, value: catalogId, unit })),
  );
  const held = new Map<string, Set<string>>();
  for (const document of seed.collections.documents) {
    if (known.has(document.catalogId)) continue;
    const units = held.get(document.catalogId) ?? new Set<string>();
    if (document.unit !== null) units.add(document.unit.value);
    held.set(document.catalogId, units);
  }
  for (const [value, units] of held) {
    items.push(
      ...(units.size === 0
        ? [{ type: "catalogId" as const, value, unit: null }]
        : [...units].map((unit) => ({ type: "catalogId" as const, value, unit }))),
    );
  }
  return items;
}

export function itemKey(item: Item): string {
  return `${item.value}|${item.unit ?? ""}`;
}

export async function submittableItems(
  api: APIRequestContext,
  excluded: Item[] = [],
  count = Number.POSITIVE_INFINITY,
): Promise<Item[]> {
  const keys = new Set(excluded.map(itemKey));
  const selected: Item[] = [];
  for (const item of seedItems()) {
    if (keys.has(itemKey(item))) continue;
    const lookup = await api.post("/api/proposals/lookup", { data: { items: [item] } });
    const [answer] = (await lookup.json()) as { kind: string }[];
    if (answer?.kind === "new" || answer?.kind === "inVera") selected.push(item);
    if (selected.length === count) return selected;
  }
  if (selected.length < count) {
    throw new Error(`Only ${selected.length} submittable catalog items remain; need ${count}`);
  }
  return selected;
}

export function lines(items: Item[]): string {
  return items.map(({ value, unit }) => (unit === null ? value : `${value};${unit}`)).join("\n");
}

export async function setDailyLimit(
  admin: APIRequestContext,
  roleId: "reader" | "staff",
  proposalDailyLimit: number,
): Promise<void> {
  const response = await admin.get("/api/access");
  const index = (await response.json()) as {
    roles: {
      id: string;
      names: Record<string, string>;
      description: string;
      grants: unknown[];
      proposalBatchLimit: number;
      proposalDailyLimit: number;
    }[];
  };
  const role = index.roles.find(({ id }) => id === roleId);
  if (role === undefined) throw new Error(`No ${roleId} role in access settings`);
  const saved = await admin.put(`/api/access/roles/${role.id}`, {
    data: {
      names: role.names,
      description: role.description,
      grants: role.grants,
      proposalBatchLimit: role.proposalBatchLimit,
      proposalDailyLimit,
    },
  });
  if (!saved.ok())
    throw new Error(`Could not lower ${roleId} limit (${saved.status()}): ${await saved.text()}`);
}

export async function seedRequests(
  api: APIRequestContext,
  items: Item[],
  batchLimit: number,
): Promise<void> {
  for (let start = 0; start < items.length; start += batchLimit) {
    const submitted = await api.post("/api/proposals", {
      data: {
        items: items.slice(start, start + batchLimit).map((item) => ({ ...item, reason: null })),
        reason: "Journey daily limit setup",
        projectId: null,
        batchName: null,
        approval: null,
        entrySourceId: null,
      },
    });
    if (submitted.status() !== 201) {
      throw new Error(`Proposal setup failed (${submitted.status()}): ${await submitted.text()}`);
    }
  }
}
