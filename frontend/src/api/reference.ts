// Reference data other records point at by id: people and their groups, the category tree,
// projects, lists and batches. Views resolve names through these instead of receiving them denormalized.

import { z } from "zod";
import { getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import type { Batch, Category, DigitizationList, Project, User } from "@/domain/entities";
import {
  batchSchema,
  categorySchema,
  digitizationListSchema,
  projectSchema,
  userSchema,
} from "@/domain/entities";

// A group: everyone in it is a project member, or holds custody, while they are in it.
export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  peopleCount: z.number().int().nonnegative(),
});
export type Group = z.infer<typeof groupSchema>;

export async function listGroups(): Promise<Group[]> {
  return getJson(apiRoutes.groups, z.array(groupSchema));
}

export async function listUsers(): Promise<User[]> {
  return getJson(apiRoutes.users, z.array(userSchema));
}

export async function listCategories(): Promise<Category[]> {
  return getJson(apiRoutes.categories, z.array(categorySchema));
}

export async function listProjects(): Promise<Project[]> {
  return getJson(apiRoutes.projects, z.array(projectSchema));
}

export async function listDigitizationLists(): Promise<DigitizationList[]> {
  return getJson(apiRoutes.lists, z.array(digitizationListSchema));
}

export async function listBatches(): Promise<Batch[]> {
  return getJson(apiRoutes.batches, z.array(batchSchema));
}
