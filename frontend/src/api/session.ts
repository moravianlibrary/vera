// The signed-in user with their effective grants and custody, resolved by the server.

import { apiRoutes } from "@vera/contract/routes";
import { accessUserSchema } from "@vera/domain/access";
import type { Session } from "@vera/domain/entities";
import { sessionSchema } from "@vera/domain/entities";
import { deleteResource, getJson } from "@/api/http";

export async function getSession(): Promise<Session> {
  return getJson(apiRoutes.session, sessionSchema);
}

export async function logout(): Promise<void> {
  return deleteResource(apiRoutes.sessionLogout);
}

export async function getAccount() {
  return getJson(apiRoutes.sessionAccount, accessUserSchema);
}
