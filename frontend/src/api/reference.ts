// Calls the reference endpoints; what they take and answer is in @vera/contract/reference.

import type { Group, RoleName } from "@vera/contract/reference";
import { groupSchema, roleNameSchema } from "@vera/contract/reference";
import { apiRoutes } from "@vera/contract/routes";
import type { Batch, Category, DigitizationList, Project, User } from "@vera/domain/entities";
import {
  batchSchema,
  categorySchema,
  digitizationListSchema,
  projectSchema,
  userSchema,
} from "@vera/domain/entities";
import type { PluginInstance } from "@vera/domain/plugins";
import { pluginInstanceSchema } from "@vera/domain/plugins";
import { z } from "zod";
import { getJson } from "@/api/http";

export async function listGroups(): Promise<Group[]> {
  return getJson(apiRoutes.groups, z.array(groupSchema));
}

export async function listRoles(): Promise<RoleName[]> {
  return getJson(apiRoutes.roles, z.array(roleNameSchema));
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

export async function listPluginInstances(): Promise<PluginInstance[]> {
  return getJson(apiRoutes.pluginInstances, z.array(pluginInstanceSchema));
}
