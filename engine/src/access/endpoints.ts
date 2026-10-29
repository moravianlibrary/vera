// The session endpoints.

import { endpoints } from "@vera/contract/endpoints";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { isSuspendedUser, sessionOf } from "./session";

export const sessionEndpoints = [
  implement(endpoints.session, ({ caller, engine }) => {
    // ACCESS-suspend: a suspended person is not signed in.
    if (caller === null || isSuspendedUser(engine.db, caller.userId)) {
      return problem(401, "Nobody is signed in.");
    }

    const session = sessionOf(engine.db, caller.userId);
    return session === null ? problem(401, "Nobody is signed in.") : { body: session };
  }),
];
