// Seeds: the state the engine starts from, one JSON file per seed in seeds/. A seed holds the
// engine's moment, the fixture person each dev server signs in as, and the records by
// collection, as the mock's database held them. Each step loads the collections its tables hold
// and leaves the rest in the file for the step that needs them.

import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extendSeed } from "@vera/contract/seed-extends";
import {
  accessGroupSchema,
  identitySchema,
  mappedRoleSchema,
  roleSchema,
} from "@vera/domain/access";
import {
  batchSchema,
  categorySchema,
  documentSchema,
  iterationSchema,
  projectSchema,
  requestSchema,
  userSchema,
} from "@vera/domain/entities";
import { eventEntrySchema } from "@vera/domain/events";
import { propertyDefinitionSchema } from "@vera/domain/properties";
import { z } from "zod";

export const seedsDir = join(import.meta.dir, "..", "seeds");

const id = z.string().min(1);

// How each person signs in and holds their roles, as the mock's fixtures keep it.
const userAccessSchema = z.object({
  handRoleIds: z.array(id),
  mappedRoles: z.array(mappedRoleSchema),
  identities: z.array(identitySchema),
  entry: z.string().nullable(),
  suspendedAt: z.iso.datetime().nullable().optional(),
});

export const seedSchema = z.object({
  name: z.string().min(1),
  extends: z.string().optional(),
  now: z.iso.datetime(),
  // Collections a step does not load yet pass through unread.
  collections: z.looseObject({
    users: z.array(userSchema),
    roles: z.array(roleSchema),
    userAccess: z.record(id, userAccessSchema),
    categories: z.array(categorySchema),
    groups: z.array(accessGroupSchema),
    projects: z.array(projectSchema).optional(),
    batches: z.array(batchSchema.omit({ size: true })).optional(),
    documents: z.array(documentSchema).optional(),
    iterations: z.array(iterationSchema).optional(),
    requests: z.array(requestSchema).optional(),
    propertyDefinitions: z.array(propertyDefinitionSchema.omit({ isCatalogFact: true })).optional(),
    deletedPropertyKeys: z.array(id).optional(),
    categoryMembers: z.record(id, z.array(id)),
    requestCustodies: z
      .array(
        z.object({
          id,
          name: z.string(),
          description: z.string(),
          isFallback: z.boolean(),
          memberIds: z.array(id),
          groupIds: z.array(id),
        }),
      )
      .optional(),
    statusLog: z.array(eventEntrySchema).optional(),
    pluginImplementations: z
      .array(
        z.looseObject({ id, name: z.string(), kind: z.string(), versions: z.array(z.unknown()) }),
      )
      .optional(),
    pluginInstances: z
      .array(
        z.looseObject({
          id,
          name: z.string(),
          implementationId: id,
          configuration: z.record(z.string(), z.unknown()),
          settings: z.unknown().nullable().optional(),
          triggers: z.array(z.string()),
          isEnabled: z.boolean(),
          isDeleted: z.boolean().optional(),
          createdAt: z.string(),
          lastRunAt: z.string().nullable().optional(),
        }),
      )
      .optional(),
  }),
  // Data the fake plugins answer from: the catalog's records and the like.
  fakes: z.record(z.string(), z.unknown()).optional(),
});
export type Seed = z.infer<typeof seedSchema>;

export class SeedNotFound extends Error {}

export const seedNamePattern = /^[a-z0-9-]+$/;

export function readSeed(name: string, dir: string = seedsDir, chain: string[] = []): Seed {
  if (chain.includes(name)) {
    throw new Error(`seed ${name} extends itself through ${[...chain, name].join(" -> ")}`);
  }
  const path = join(dir, `${name}.json`);
  if (!seedNamePattern.test(name) || !existsSync(path)) {
    throw new SeedNotFound(`There is no seed named ${name}.`);
  }

  const raw = JSON.parse(readFileSync(path, "utf8"));
  // A seed may extend another that extends in turn; a loop is refused.
  if (typeof raw.extends === "string") {
    const parent = readSeed(raw.extends, dir, [...chain, name]) as unknown as Record<
      string,
      unknown
    >;
    return seedSchema.parse(extendSeed(parent, raw));
  }

  return seedSchema.parse(raw);
}

// Writes the collections step 1's tables hold. The caller runs it in a transaction.
export function loadSeed(db: Database, seed: Seed): void {
  const { users, roles, userAccess, categories, groups, categoryMembers } = seed.collections;
  const fakeSchema = z
    .object({
      custodyPlacements: z.record(id, z.array(id)).optional(),
      custodyRules: z
        .array(
          z.object({
            custodyId: id,
            documentType: z.string().optional(),
            projectId: id.optional(),
          }),
        )
        .optional(),
      materialLeaves: z
        .record(z.string(), z.object({ categoryId: id, reason: z.string() }))
        .optional(),
      moravianPlaces: z.array(z.string()).optional(),
      catalogRecords: z
        .array(
          z.object({
            catalogId: id,
            title: z.string(),
            type: z.string(),
            units: z.array(z.string()).nullable(),
            identifiers: z.array(z.string()),
            shelfMarks: z.record(z.string(), z.string().nullable()),
            barcodes: z.record(z.string(), z.string().nullable()),
          }),
        )
        .optional(),
      catalogBases: z
        .record(z.string(), z.object({ base: z.string(), opacUrl: z.url() }))
        .optional(),
      photo: z
        .object({
          seen: z.string(),
          read: z.array(z.object({ label: z.string(), value: z.string(), confidence: z.number() })),
          best: z.string(),
          near: z.string(),
        })
        .optional(),
      catalogReading: z
        .object({
          source: z.object({ kind: z.literal("plugin"), instanceId: id, instanceName: z.string() }),
          tier: z.number(),
        })
        .optional(),
    })
    .passthrough();
  const fakes = fakeSchema.parse(seed.fakes ?? {});
  for (const [key, value] of Object.entries(fakes))
    db.query("INSERT INTO seed_fakes (key,value) VALUES (?,?)").run(key, JSON.stringify(value));
  const insertRecord = (table: string, id: string, record: unknown) =>
    db.query(`INSERT INTO ${table} (id, record) VALUES (?, ?)`).run(id, JSON.stringify(record));
  for (const record of seed.collections.projects ?? []) insertRecord("projects", record.id, record);
  for (const record of seed.collections.batches ?? []) insertRecord("batches", record.id, record);
  for (const record of seed.collections.documents ?? [])
    insertRecord("documents", record.id, record);
  for (const record of seed.collections.iterations ?? []) {
    db.query("INSERT INTO iterations (id, document_id, record) VALUES (?, ?, ?)").run(
      record.id,
      record.documentId,
      JSON.stringify(record),
    );
  }
  for (const record of seed.collections.requests ?? []) {
    db.query("INSERT INTO requests (id, document_id, batch_id, record) VALUES (?, ?, ?, ?)").run(
      record.id,
      record.documentId,
      record.batchId,
      JSON.stringify(record),
    );
  }
  for (const record of seed.collections.propertyDefinitions ?? []) {
    db.query("INSERT INTO property_definitions (key, record) VALUES (?, ?)").run(
      record.key,
      JSON.stringify(record),
    );
  }
  for (const key of seed.collections.deletedPropertyKeys ?? [])
    db.query("INSERT INTO deleted_property_keys (key) VALUES (?)").run(key);
  for (const entry of seed.collections.statusLog ?? []) {
    const parsed = eventEntrySchema.parse(entry);
    db.query(`INSERT INTO events (id,code,subject_kind,subject_id,at,actor,correlation_id,data,reason_public,reason_internal)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      parsed.id,
      parsed.code,
      parsed.subjectKind,
      parsed.subjectId,
      parsed.at,
      JSON.stringify(parsed.actor),
      parsed.correlationId,
      JSON.stringify(parsed.data),
      parsed.reason.public,
      parsed.reason.internal,
    );
  }
  const insertUser = db.query(
    "INSERT INTO users (id, name, kind, email, entry, suspended_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const user of users) {
    const access = userAccess[user.id];
    insertUser.run(
      user.id,
      user.name,
      user.kind,
      user.email,
      access?.entry ?? null,
      access?.suspendedAt ?? null,
    );
  }

  const insertRole = db.query(
    "INSERT INTO roles (id, name, description, is_shipped, grants, proposal_batch_limit, proposal_daily_limit) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const role of roles) {
    insertRole.run(
      role.id,
      role.name,
      role.description,
      role.isShipped ? 1 : 0,
      JSON.stringify(role.grants),
      role.proposalBatchLimit,
      role.proposalDailyLimit,
    );
  }

  const insertHand = db.query("INSERT INTO user_hand_roles (user_id, role_id) VALUES (?, ?)");
  const insertMapped = db.query(
    "INSERT INTO user_mapped_roles (user_id, role_id, instance_id, claim) VALUES (?, ?, ?, ?)",
  );
  const insertIdentity = db.query(
    "INSERT INTO user_identities (user_id, instance_id, external_id, last_login_at) VALUES (?, ?, ?, ?)",
  );
  for (const [userId, access] of Object.entries(userAccess)) {
    for (const roleId of access.handRoleIds) {
      insertHand.run(userId, roleId);
    }
    for (const mapped of access.mappedRoles) {
      insertMapped.run(userId, mapped.roleId, mapped.instanceId, mapped.claim);
    }
    for (const identity of access.identities) {
      insertIdentity.run(userId, identity.instanceId, identity.externalId, identity.lastLoginAt);
    }
  }

  const insertCategory = db.query("INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)");
  for (const category of categories) {
    insertCategory.run(category.id, category.name, category.parentId);
  }

  const insertGroup = db.query("INSERT INTO groups (id, name, description) VALUES (?, ?, ?)");
  const insertGroupMember = db.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)");
  const insertGroupCategory = db.query(
    "INSERT INTO group_categories (group_id, category_id) VALUES (?, ?)",
  );
  for (const group of groups) {
    insertGroup.run(group.id, group.name, group.description);
    for (const userId of group.memberIds) {
      insertGroupMember.run(group.id, userId);
    }
    for (const categoryId of group.categoryIds) {
      insertGroupCategory.run(group.id, categoryId);
    }
  }

  const insertCategoryMember = db.query(
    "INSERT INTO category_members (category_id, user_id) VALUES (?, ?)",
  );
  for (const [categoryId, userIds] of Object.entries(categoryMembers)) {
    for (const userId of userIds) {
      insertCategoryMember.run(categoryId, userId);
    }
  }

  const insertCustody = db.query(
    "INSERT INTO request_custodies (id, name, description, is_fallback) VALUES (?, ?, ?, ?)",
  );
  const insertCustodyMember = db.query(
    "INSERT INTO request_custody_members (custody_id, user_id) VALUES (?, ?)",
  );
  const insertCustodyGroup = db.query(
    "INSERT INTO request_custody_groups (custody_id, group_id) VALUES (?, ?)",
  );
  for (const custody of seed.collections.requestCustodies ?? []) {
    insertCustody.run(custody.id, custody.name, custody.description, custody.isFallback ? 1 : 0);
    for (const userId of custody.memberIds) insertCustodyMember.run(custody.id, userId);
    for (const groupId of custody.groupIds) insertCustodyGroup.run(custody.id, groupId);
  }

  const insertImplementation = db.query(
    "INSERT INTO plugin_implementations (id, name, kind, versions) VALUES (?, ?, ?, ?)",
  );
  for (const implementation of seed.collections.pluginImplementations ?? []) {
    insertImplementation.run(
      implementation.id,
      implementation.name,
      implementation.kind,
      JSON.stringify(implementation.versions),
    );
  }
  const insertInstance = db.query(
    `INSERT INTO plugin_instances (id, name, implementation_id, configuration, settings, triggers, is_enabled, is_deleted, created_at, last_run_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const instance of seed.collections.pluginInstances ?? []) {
    insertInstance.run(
      instance.id,
      instance.name,
      instance.implementationId,
      JSON.stringify(instance.configuration),
      instance.settings == null ? null : JSON.stringify(instance.settings),
      JSON.stringify(instance.triggers),
      instance.isEnabled ? 1 : 0,
      instance.isDeleted ? 1 : 0,
      instance.createdAt,
      instance.lastRunAt ?? null,
    );
  }
  const identityAccounts = seed.fakes?.identityAccounts as
    | Record<
        string,
        {
          externalId: string;
          name: string;
          email: string | null;
          emailVerified: boolean;
          claims: string[];
        }[]
      >
    | undefined;
  const insertFake = db.query(
    "INSERT INTO fake_identity_accounts (instance_id, external_id, name, email, email_verified, claims) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const [instanceId, accounts] of Object.entries(identityAccounts ?? {})) {
    for (const account of accounts) {
      insertFake.run(
        instanceId,
        account.externalId,
        account.name,
        account.email,
        account.emailVerified ? 1 : 0,
        JSON.stringify(account.claims),
      );
    }
  }
}
