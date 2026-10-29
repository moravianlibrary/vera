// Logging in (ACCESS-login-page). A form entry posts its credentials and the server answers with
// the session cookie. A redirect entry leaves the page for the provider; the mock cannot follow
// one, so in mock mode it asks a mock-only endpoint to sign in and goes straight back.

import type { LocalLogin, LoginEntry } from "@vera/contract/login";
import { loginEntrySchema } from "@vera/contract/login";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { getJson, postNoContent } from "@/api/http";
import { env } from "@/config/env";

export async function listLoginEntries(): Promise<LoginEntry[]> {
  return getJson(apiRoutes.login, z.array(loginEntrySchema));
}

export async function loginWithForm(instanceId: string, credentials: LocalLogin): Promise<void> {
  return postNoContent(`${apiRoutes.login}/${encodeURIComponent(instanceId)}`, credentials);
}

export async function startRedirectLogin(instanceId: string, returnTo: string): Promise<void> {
  const path = `${apiRoutes.login}/${encodeURIComponent(instanceId)}`;
  if (env.VITE_API_MODE === "mock") {
    await postNoContent(`${path}/mock`, {});
    window.location.assign(returnTo);
    return;
  }

  window.location.assign(
    `${env.VITE_API_BASE_URL}${path}?returnTo=${encodeURIComponent(returnTo)}`,
  );
}
