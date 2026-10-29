// The session endpoints.

import { endpoints } from "@vera/contract/endpoints";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { isSuspendedUser, sessionOf } from "./session";
import { clearedSessionCookie, endSession } from "./sessions";

export const sessionEndpoints = [
  implement(endpoints.session, ({ caller, engine }) => {
    // ACCESS-suspend: a suspended person is not signed in.
    if (caller === null || isSuspendedUser(engine.db, caller.userId)) {
      return problem(401, "Nobody is signed in.");
    }

    const session = sessionOf(engine.db, caller.userId);
    return session === null ? problem(401, "Nobody is signed in.") : { body: session };
  }),
  implement(endpoints.logout, ({ caller, engine }) => {
    if (caller !== null) {
      endSession(engine, caller.tokenHash);
    }
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": clearedSessionCookie(engine.development) },
    });
  }),
];
