// The signed-in user with their effective grants and custody, resolved by the server.

import { getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import type { Session } from "@/domain/entities";
import { sessionSchema } from "@/domain/entities";

export async function getSession(): Promise<Session> {
  return getJson(apiRoutes.session, sessionSchema);
}
