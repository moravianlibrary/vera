// The signed-in user with their effective grants and custody, resolved by the server.

import { deleteResource, getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import { accessUserSchema } from "@/domain/access";
import type { Session } from "@/domain/entities";
import { sessionSchema } from "@/domain/entities";

export async function getSession(): Promise<Session> {
  return getJson(apiRoutes.session, sessionSchema);
}

export async function logout(): Promise<void> {
  return deleteResource(apiRoutes.sessionLogout);
}

export async function getAccount() {
  return getJson(apiRoutes.sessionAccount, accessUserSchema);
}
