// Reference data other records point at by id: people, their groups and roles, the category tree,
// projects, lists, batches and plugin instances. Views resolve names through these instead of
// receiving them denormalized.

import { z } from "zod";

// A group: everyone in it is a project member, or holds custody, while they are in it.
export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  peopleCount: z.number().int().nonnegative(),
});

export type Group = z.infer<typeof groupSchema>;

// A role by name: who a watchlist is shared with names roles.
export const roleNameSchema = z.object({ id: z.string(), name: z.string() });

export type RoleName = z.infer<typeof roleNameSchema>;
