import { endpoints } from "@vera/contract/endpoints";
import { safeReturnTo } from "@vera/contract/return-to";
import { apiRoutes } from "@vera/contract/routes";
import { openSession, sessionCookie } from "../access/sessions";
import type { Engine } from "../engine";
import type { Endpoint } from "../http/endpoint";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { withPluginSpan } from "../telemetry/telemetry";
import { callback, startUrl } from "./fake-redirect";
import { identityInstance, identityInstances } from "./instances";
import { formLogin } from "./local-accounts";
import { logIn } from "./login";

function mailChannelExists(engine: Engine): boolean {
  return (
    engine.db
      .query(
        "SELECT 1 FROM plugin_instances i JOIN plugin_implementations p ON p.id = i.implementation_id WHERE p.kind = 'DeliveryChannel' AND i.is_enabled = 1 AND i.is_deleted = 0",
      )
      .get() !== null
  );
}

const loginEntries = implement(endpoints.loginEntries, ({ engine }) => ({
  body: identityInstances(engine).map((instance) => {
    const form = instance.entry === "form";
    const mail = form && mailChannelExists(engine);
    return {
      instanceId: instance.id,
      label: instance.settings.label,
      entry: instance.entry,
      canSignUp: mail && instance.configuration.signup === "on",
      canResetPassword: mail,
    };
  }),
}));

const loginForm = implement(endpoints.loginForm, async ({ engine, params, body }) => {
  const instance = identityInstance(engine, params.instanceId);
  if (instance?.entry !== "form")
    return problem(404, "There is no local login for this instance.", {});
  const identity = await withPluginSpan(
    instance.id,
    implementationName(engine, instance.implementationId),
    () => formLogin(engine, instance, body.username, body.password),
    (result) => (result === null ? "refused" : "answered"),
  );
  if (identity === null) return problem(401, "The username or password is not accepted.");
  const loggedIn = logIn(engine, instance, identity);
  if ("refusal" in loggedIn)
    return problem(403, "This person is suspended.", { code: "access.suspended" });
  const token = openSession(engine, loggedIn.userId, instance.id);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": sessionCookie(token, engine.development) },
  });
});

const loginStart = implement(endpoints.loginStart, ({ engine, params, query }) => {
  const instance = identityInstance(engine, params.instanceId);
  if (instance?.entry !== "redirect")
    return problem(404, "There is no redirect login for this instance.", {});
  const flowId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
  engine.db
    .query("INSERT INTO login_flows (id, instance_id, return_to, created_at) VALUES (?, ?, ?, ?)")
    .run(
      flowId,
      instance.id,
      safeReturnTo(query.returnTo ?? null),
      engine.clock.now().toISOString(),
    );
  return new Response(null, { status: 302, headers: { Location: startUrl(instance, flowId) } });
});

const loginCallback = implement(endpoints.loginCallback, ({ engine, params, query }) => {
  const row = engine.db
    .query<{ id: string; instance_id: string; return_to: string; created_at: string }, [string]>(
      "SELECT id, instance_id, return_to, created_at FROM login_flows WHERE id = ?",
    )
    .get(query.flow);
  const expired =
    row === null ||
    row.instance_id !== params.instanceId ||
    engine.clock.now().getTime() - Date.parse(row.created_at) > 10 * 60 * 1000;
  if (row !== null) engine.db.query("DELETE FROM login_flows WHERE id = ?").run(row.id);
  if (expired)
    return new Response(null, { status: 302, headers: { Location: "/login?error=login.expired" } });
  const instance = identityInstance(engine, params.instanceId);
  if (instance?.entry !== "redirect")
    return new Response(null, { status: 302, headers: { Location: "/login?error=login.expired" } });
  const identity = withPluginSpan(
    instance.id,
    implementationName(engine, instance.implementationId),
    () => callback(engine, instance, query.code),
    (result) => (result === null ? "refused" : "answered"),
  );
  if (identity === null)
    return new Response(null, { status: 302, headers: { Location: "/login?error=login.unknown" } });
  const loggedIn = logIn(engine, instance, identity);
  if ("refusal" in loggedIn)
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=access.suspended" },
    });
  const token = openSession(engine, loggedIn.userId, instance.id);
  return new Response(null, {
    status: 302,
    headers: { Location: row.return_to, "Set-Cookie": sessionCookie(token, engine.development) },
  });
});

function implementationName(engine: Engine, implementationId: string): string {
  return (
    engine.db
      .query<{ name: string }, [string]>("SELECT name FROM plugin_implementations WHERE id = ?")
      .get(implementationId)?.name ?? "Identity"
  );
}

export const loginEndpoints: readonly Endpoint[] = [
  loginEntries,
  loginForm,
  loginStart,
  loginCallback,
];
export const loginApiPath = apiRoutes.login;
