// The signed-in person's session, resolved afresh on every request: their roles however they
// hold them (ACCESS-role-ways), grants as the union of those roles, category custody from their
// groups and their own (ACCESS-group), and nothing while they are suspended (ACCESS-suspend).

import type { Database } from "bun:sqlite";
import type { Role } from "@vera/domain/access";
import { grantsOf, heldRoleIdsOf, isSuspended } from "@vera/domain/access";
import type { Session, User } from "@vera/domain/entities";

interface UserRow {
  id: string;
  name: string;
  kind: User["kind"];
  email: string | null;
  suspended_at: string | null;
}

interface RoleRow {
  id: string;
  name: string;
  description: string;
  is_shipped: number;
  grants: string;
  proposal_batch_limit: number | null;
  proposal_daily_limit: number | null;
}

export function rolesOf(db: Database): Role[] {
  return db
    .query<RoleRow, []>("SELECT * FROM roles ORDER BY rowid")
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isShipped: row.is_shipped === 1,
      grants: JSON.parse(row.grants),
      proposalBatchLimit: row.proposal_batch_limit,
      proposalDailyLimit: row.proposal_daily_limit,
    }));
}

function userRowOf(db: Database, userId: string): UserRow | null {
  return db
    .query<UserRow, [string]>("SELECT id, name, kind, email, suspended_at FROM users WHERE id = ?")
    .get(userId);
}

function roleHolderOf(db: Database, row: UserRow) {
  return {
    handRoleIds: db
      .query<{ role_id: string }, [string]>(
        "SELECT role_id FROM user_hand_roles WHERE user_id = ? ORDER BY rowid",
      )
      .all(row.id)
      .map(({ role_id }) => role_id),
    mappedRoles: db
      .query<{ role_id: string; instance_id: string; claim: string }, [string]>(
        "SELECT role_id, instance_id, claim FROM user_mapped_roles WHERE user_id = ? ORDER BY rowid",
      )
      .all(row.id)
      .map(({ role_id, instance_id, claim }) => ({
        roleId: role_id,
        instanceId: instance_id,
        claim,
      })),
    suspendedAt: row.suspended_at,
  };
}

// ACCESS-suspend: their login is refused.
export function isSuspendedUser(db: Database, userId: string): boolean {
  const row = userRowOf(db, userId);
  return row !== null && row.suspended_at !== null;
}

export function sessionOf(db: Database, userId: string): Session | null {
  const row = userRowOf(db, userId);
  if (row === null) {
    return null;
  }

  const holder = roleHolderOf(db, row);
  const roleIds = isSuspended(holder) ? [] : heldRoleIdsOf(holder);
  const groupIds = db
    .query<{ group_id: string }, [string]>(
      "SELECT group_id FROM group_members WHERE user_id = ? ORDER BY rowid",
    )
    .all(userId)
    .map(({ group_id }) => group_id);
  // Through their groups first, in the groups' order, then their own (as the mock resolves it).
  const viaGroups = db
    .query<{ category_id: string }, [string]>(
      `SELECT gc.category_id FROM group_categories gc
         JOIN group_members gm ON gm.group_id = gc.group_id
         WHERE gm.user_id = ?
         ORDER BY gc.rowid`,
    )
    .all(userId);
  const direct = db
    .query<{ category_id: string }, [string]>(
      "SELECT category_id FROM category_members WHERE user_id = ? ORDER BY rowid",
    )
    .all(userId);
  const custody = [...viaGroups, ...direct].map(({ category_id }) => category_id);
  return {
    user: { id: row.id, name: row.name, kind: row.kind, email: row.email },
    roleIds,
    grants: grantsOf(rolesOf(db), roleIds),
    custodyCategoryIds: [...new Set(custody)],
    groupIds,
  };
}
