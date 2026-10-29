// Faults the mock can simulate, chosen by VITE_MOCK_FAULT: the whole server unavailable; every
// answer but the session and login failing, so each page's own error state shows; or every
// answer late, so loading states show. They sit before the real handlers.

import type { RequestHandler } from "msw";
import { delay, HttpResponse, http } from "msw";
import type { MockFault } from "@/config/env";
import { env } from "@/config/env";

const everything = `${env.VITE_API_BASE_URL}/*`;
const slowMilliseconds = 1500;

const unavailable = () =>
  HttpResponse.json(
    { type: "about:blank", title: "Service Unavailable", status: 503 },
    { status: 503, headers: { "Content-Type": "application/problem+json" } },
  );

export function faultHandlers(fault: MockFault): RequestHandler[] {
  switch (fault) {
    case "none":
      return [];
    case "unavailable":
      return [http.all(everything, unavailable)];
    case "data":
      return [
        http.all(everything, ({ request }) => {
          const path = new URL(request.url).pathname.slice(env.VITE_API_BASE_URL.length);
          return path.startsWith("/session") || path.startsWith("/login")
            ? undefined
            : unavailable();
        }),
      ];
    case "slow":
      return [
        http.all(everything, async () => {
          await delay(slowMilliseconds);
        }),
      ];
  }
}
