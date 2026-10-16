// The session endpoints.

import { apiRoutes } from "@vera/contract/routes";
import { sessionSchema } from "@vera/domain/entities";
import { endpoint } from "../http/endpoint";
import { problem } from "../http/problem";
import { isSuspendedUser, sessionOf } from "./session";

export const sessionEndpoints = [
  endpoint({
    method: "GET",
    path: apiRoutes.session,
    response: sessionSchema,
    handle({ caller, engine }) {
      // ACCESS-suspend: a suspended person is not signed in.
      if (caller === null || isSuspendedUser(engine.db, caller.userId)) {
        return problem(401, "Nobody is signed in.");
      }

      const session = sessionOf(engine.db, caller.userId);
      return session === null ? problem(401, "Nobody is signed in.") : { body: session };
    },
  }),
];
