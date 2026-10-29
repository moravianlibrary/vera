import { beforeEach, describe, expect, it } from "bun:test";
import { call, cookieOf, testEngine } from "../../test/engine";
import type { Engine } from "../engine";

let engine: Engine;
beforeEach(() => {
  engine = testEngine("base");
});

function flowFrom(response: Response): string {
  const location = response.headers.get("Location");
  if (location === null) throw new Error("Expected a redirect location");
  const flow = new URL(location, "http://engine.test").searchParams.get("flow");
  if (flow === null) throw new Error("Expected a login flow");
  return flow;
}

function accounts(instance: string) {
  return engine.db
    .query<{ external_id: string }, [string]>(
      "SELECT external_id FROM fake_identity_accounts WHERE instance_id = ? ORDER BY rowid",
    )
    .all(instance);
}
async function callback(instance: string, flow: string, code: string) {
  return call(
    engine,
    "GET",
    `/api/login/${instance}/callback?flow=${encodeURIComponent(flow)}&code=${encodeURIComponent(code)}`,
  );
}

describe("Identity login", () => {
  it("lists enabled Identity entries in order", async () => {
    const response = await call(engine, "GET", "/api/login");
    const entries = (await response.json()) as {
      instanceId: string;
      entry: string;
      canSignUp: boolean;
      canResetPassword: boolean;
    }[];
    expect(entries.map((entry: { instanceId: string }) => entry.instanceId)).toEqual([
      "pi22",
      "pi23",
      "pi24",
      "pi41",
      "pi42",
    ]);
    expect(
      entries
        .filter((entry: { entry: string }) => entry.entry === "form")
        .map((entry: { instanceId: string }) => entry.instanceId),
    ).toEqual(["pi24"]);
    expect(entries[2].canSignUp).toBe(false);
    expect(entries[2].canResetPassword).toBe(false);
  });
  it("omits a disabled instance", async () => {
    engine.db.query("UPDATE plugin_instances SET is_enabled = 0 WHERE id = 'pi23'").run();
    const response = await call(engine, "GET", "/api/login");
    expect(
      ((await response.json()) as { instanceId: string }[]).map((entry) => entry.instanceId),
    ).not.toContain("pi23");
  });
  it("accepts the first local password and opens a session", async () => {
    const identity = engine.db
      .query<{ external_id: string; user_id: string }, []>(
        "SELECT external_id, user_id FROM user_identities WHERE instance_id = 'pi24' LIMIT 1",
      )
      .get();
    if (identity === null) throw new Error("Expected a local identity");
    const response = await call(engine, "POST", "/api/login/pi24", {
      body: { username: identity.external_id, password: "pass" },
    });
    expect(response.status).toBe(204);
    const cookie = cookieOf(response);
    expect(cookie).not.toBeNull();
    const session = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${cookie}` },
      }),
    );
    expect(((await session.json()) as { user: { id: string } }).user.id).toBe(identity.user_id);
  });
  it("keeps the first password and rejects a later wrong one", async () => {
    const identity = engine.db
      .query<{ external_id: string }, []>(
        "SELECT external_id FROM user_identities WHERE instance_id = 'pi24' LIMIT 1",
      )
      .get();
    if (identity === null) throw new Error("Expected a local identity");
    const username = identity.external_id;
    await call(engine, "POST", "/api/login/pi24", { body: { username, password: "first" } });
    expect(
      (await call(engine, "POST", "/api/login/pi24", { body: { username, password: "wrong" } }))
        .status,
    ).toBe(401);
    expect(
      (await call(engine, "POST", "/api/login/pi24", { body: { username, password: "first" } }))
        .status,
    ).toBe(204);
  });
  it("rejects an unknown local username", async () => {
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: "missing", password: "pass" },
        })
      ).status,
    ).toBe(401);
  });
  it("starts a redirect flow and keeps a safe return path", async () => {
    const response = await call(engine, "GET", "/api/login/pi22?returnTo=%2Fdocuments");
    expect(response.status).toBe(302);
    const flow = flowFrom(response);
    expect(
      engine.db
        .query<{ return_to: string }, [string]>("SELECT return_to FROM login_flows WHERE id = ?")
        .get(flow)?.return_to,
    ).toBe("/documents");
  });
  it("shows fake accounts with callback links", async () => {
    const start = await call(engine, "GET", "/api/login/pi22");
    const flow = flowFrom(start);
    const page = await call(engine, "GET", `/_engine/identity/pi22?flow=${flow}`);
    const html = await page.text();
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("/api/login/pi22/callback?");
    expect(accounts("pi22")).toHaveLength(7);
  });
  it("logs in an existing identity and reevaluates mapped roles", async () => {
    const account = accounts("pi22")[0];
    if (account === undefined) throw new Error("Expected a fake account");
    const start = await call(engine, "GET", "/api/login/pi22?returnTo=%2Fdocuments");
    const flow = flowFrom(start);
    const response = await callback("pi22", flow, account.external_id);
    expect(response.headers.get("Location")).toBe("/documents");
    expect(cookieOf(response)).not.toBeNull();
    const found = engine.db
      .query<{ user_id: string }, [string, string]>(
        "SELECT user_id FROM user_identities WHERE instance_id = ? AND external_id = ?",
      )
      .get("pi22", account.external_id);
    if (found === null) throw new Error("Expected a linked user");
    const userId = found.user_id;
    engine.db
      .query(
        "UPDATE fake_identity_accounts SET claims = ? WHERE instance_id = 'pi22' AND external_id = ?",
      )
      .run(JSON.stringify(["group mzk-curators"]), account.external_id);
    const second = await call(engine, "GET", "/api/login/pi22");
    const flow2 = flowFrom(second);
    await callback("pi22", flow2, account.external_id);
    expect(
      engine.db
        .query<{ role_id: string }, [string]>(
          "SELECT role_id FROM user_mapped_roles WHERE user_id = ? AND instance_id = 'pi22'",
        )
        .all(userId)
        .map((row) => row.role_id),
    ).toEqual(["curator"]);
  });
  it("drops an outside return target", async () => {
    await call(engine, "GET", "/api/login/pi22?returnTo=https%3A%2F%2Fevil.example%2F");
    expect(
      engine.db
        .query<{ return_to: string }, []>(
          "SELECT return_to FROM login_flows ORDER BY rowid DESC LIMIT 1",
        )
        .get()?.return_to,
    ).toBe("/");
  });
  it("creates a first login with the default role", async () => {
    const start = await call(engine, "GET", "/api/login/pi23");
    const flow = flowFrom(start);
    await callback("pi23", flow, "nova.ctenarka@muni.cz");
    const user = engine.db
      .query<{ id: string }, []>("SELECT id FROM users WHERE email = 'nova.ctenarka@muni.cz'")
      .get();
    if (user === null) throw new Error("Expected the new person");
    expect(
      engine.db
        .query<{ role_id: string; claim: string }, [string]>(
          "SELECT role_id, claim FROM user_mapped_roles WHERE user_id = ?",
        )
        .all(user.id),
    ).toContainEqual({ role_id: "reader", claim: "default role" });
  });
  it("matches a verified email to the existing person", async () => {
    const account = accounts("pi23").find((row) => row.external_id.startsWith("eduid-"));
    if (account === undefined) throw new Error("Expected the email match account");
    const expected = account.external_id.slice("eduid-".length);
    const countBefore = engine.db
      .query<{ count: number }, []>("SELECT count(*) AS count FROM users")
      .get()?.count;
    const start = await call(engine, "GET", "/api/login/pi23");
    const flow = flowFrom(start);
    await callback("pi23", flow, account.external_id);
    expect(
      engine.db
        .query("SELECT 1 FROM user_identities WHERE user_id = ? AND instance_id = 'pi23'")
        .get(expected),
    ).not.toBeNull();
    expect(
      engine.db.query<{ count: number }, []>("SELECT count(*) AS count FROM users").get()?.count,
    ).toBe(countBefore);
  });
  it("creates a person with no role when there is no default", async () => {
    const start = await call(engine, "GET", "/api/login/pi22");
    const flow = flowFrom(start);
    const response = await callback("pi22", flow, "bez.skupiny");
    const user = engine.db
      .query<{ user_id: string }, []>(
        "SELECT user_id FROM user_identities WHERE instance_id = 'pi22' AND external_id = 'bez.skupiny'",
      )
      .get();
    if (user === null) throw new Error("Expected the new identity");
    expect(
      engine.db.query("SELECT 1 FROM user_mapped_roles WHERE user_id = ?").get(user.user_id),
    ).toBeNull();
    const cookie = cookieOf(response);
    expect(cookie).not.toBeNull();
    const session = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${cookie}` },
      }),
    );
    expect(((await session.json()) as { roleIds: string[] }).roleIds).toEqual([]);
  });
  it("refuses suspended people on callback and form login", async () => {
    const account = accounts("pi22")[0];
    if (account === undefined) throw new Error("Expected a fake account");
    const found = engine.db
      .query<{ user_id: string }, [string, string]>(
        "SELECT user_id FROM user_identities WHERE instance_id = ? AND external_id = ?",
      )
      .get("pi22", account.external_id);
    if (found === null) throw new Error("Expected a linked user");
    const userId = found.user_id;
    engine.db
      .query("UPDATE users SET suspended_at = ? WHERE id = ?")
      .run(engine.clock.now().toISOString(), userId);
    const start = await call(engine, "GET", "/api/login/pi22");
    const flow = flowFrom(start);
    expect((await callback("pi22", flow, account.external_id)).headers.get("Location")).toBe(
      "/login?error=access.suspended",
    );
    const local = engine.db
      .query<{ external_id: string; user_id: string }, []>(
        "SELECT external_id, user_id FROM user_identities WHERE instance_id = 'pi24' LIMIT 1",
      )
      .get();
    if (local === null) throw new Error("Expected a local identity");
    engine.db
      .query("UPDATE users SET suspended_at = ? WHERE id = ?")
      .run(engine.clock.now().toISOString(), local.user_id);
    await call(engine, "POST", "/api/login/pi24", {
      body: { username: local.external_id, password: "pass" },
    });
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: local.external_id, password: "pass" },
        })
      ).status,
    ).toBe(403);
  });
  it("expires a flow after ten minutes", async () => {
    const start = await call(engine, "GET", "/api/login/pi22");
    const flow = flowFrom(start);
    engine.clock.advance(11 * 60 * 1000);
    expect((await callback("pi22", flow, "anything")).headers.get("Location")).toBe(
      "/login?error=login.expired",
    );
  });
});
