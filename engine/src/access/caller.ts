// Who is calling: the person of the session the request carries (handoff decision 2), and the
// cookie the answer must carry back: the same session's, reissued so it slides, or a clearing
// one when the request carried a session that is gone.

import type { Engine } from "../engine";
import type { Caller } from "../http/endpoint";
import { clearedSessionCookie, sessionCookie, sessionOf, tokenOf } from "./sessions";

export interface Calling {
  caller: Caller | null;
  // A Set-Cookie value for the answer; null when it needs none.
  cookie: string | null;
}

export function callingOf(engine: Engine, request: Request): Calling {
  const session = sessionOf(engine, request);
  if (session !== null) {
    return {
      caller: { userId: session.userId, tokenHash: session.tokenHash },
      cookie: sessionCookie(session.token, engine.development),
    };
  }

  return {
    caller: null,
    cookie: tokenOf(request) === null ? null : clearedSessionCookie(engine.development),
  };
}
