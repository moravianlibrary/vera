// Seeds: the state the engine starts from, one JSON file per seed in seeds/. A seed holds the
// engine's moment, the fixture person each dev server signs in as, and the records by
// collection, as the mock's database held them. Each step loads the collections its tables hold
// and leaves the rest in the file for the step that needs them.

import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accessGroupSchema,
  identitySchema,
  mappedRoleSchema,
  roleSchema,
} from "@vera/domain/access";
import { categorySchema, userSchema } from "@vera/domain/entities";
import { z } from "zod";
import { extendSeed } from "./seed-extends";

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
    categoryMembers: z.record(id, z.array(id)),
  }),
  // Data the fake plugins answer from: the catalog's records and the like.
  fakes: z.record(z.string(), z.unknown()).optional(),
});
export type Seed = z.infer<typeof seedSchema>;

export class SeedNotFound extends Error {}

export const seedNamePattern = /^[a-z0-9-]+$/;

export function readSeed(name: string, dir: string = seedsDir): Seed {
  const path = join(dir, `${name}.json`);
  if (!seedNamePattern.test(name) || !existsSync(path)) {
    throw new SeedNotFound(`There is no seed named ${name}.`);
  }

  const raw = JSON.parse(readFileSync(path, "utf8"));
  // A seed extends at most one other, which may not extend in turn (installation extends
  // nothing); a chain would hide where a record came from.
  if (typeof raw.extends === "string") {
    const parent = JSON.parse(readFileSync(join(dir, `${raw.extends}.json`), "utf8"));
    if (parent.extends !== undefined) {
      throw new Error(`${raw.extends} extends another seed; only one level is allowed.`);
    }
    return seedSchema.parse(extendSeed(parent, raw));
  }

  return seedSchema.parse(raw);
}

// Writes the collections step 1's tables hold. The caller runs it in a transaction.
export function loadSeed(db: Database, seed: Seed): void {
  const { users, roles, userAccess, categories, groups, categoryMembers } = seed.collections;
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
}
