import { beforeEach, describe, expect, it } from "bun:test";
import { call, cookieOf, testEngine } from "../../test/engine";
import type { Engine } from "../engine";

let engine: Engine;
beforeEach(() => {
  engine = testEngine("base");
});

const signup = (
  username: string,
  email = `${username}@example.org`,
  extra: Record<string, unknown> = {},
) =>
  call(engine, "POST", "/api/signup/pi24", {
    body: {
      name: "New Person",
      email,
      username,
      password: "abcdefghijkl",
      ...extra,
    },
  });
function mailToken(subject: string): string {
  const mail = engine.outbox
    .list("mail")
    .reverse()
    .find((item) => (item.payload as { subject?: string }).subject === subject);
  const link = (mail?.payload as { link?: string } | undefined)?.link;
  if (link === undefined) throw new Error(`Expected ${subject} mail`);
  return link.split("/").at(-1) ?? "";
}
function cookie(response: Response): string {
  const value = cookieOf(response);
  if (value === null) throw new Error("Expected session cookie");
  return value;
}

describe("local sign-up and password reset", () => {
  it("keeps the existing login entry flags on the base seed", async () => {
    const response = await call(engine, "GET", "/api/login");
    const entries = (await response.json()) as {
      instanceId: string;
      canSignUp: boolean;
      canResetPassword: boolean;
    }[];
    expect(entries.find((entry) => entry.instanceId === "pi24")).toMatchObject({
      canSignUp: true,
      canResetPassword: true,
    });
    expect(entries.find((entry) => entry.instanceId === "pi22")).toMatchObject({
      canSignUp: false,
      canResetPassword: false,
    });
  });
  it("signs up, mails, verifies and creates the account with its default role", async () => {
    expect((await signup("new-user", "new@example.org", { returnTo: "/requests" })).status).toBe(
      202,
    );
    const pending = engine.db
      .query<{ token_hash: string; password_hash: string }, []>(
        "SELECT token_hash, password_hash FROM pending_sign_ups",
      )
      .get();
    expect(pending?.password_hash).not.toContain("abcdefghijkl");
    expect(engine.outbox.list("mail").at(-1)?.payload).toMatchObject({
      subject: "Verify your email",
      link: expect.stringContaining("/verify-email/"),
    });
    const response = await call(engine, "POST", "/api/email-verification/confirm", {
      body: { token: mailToken("Verify your email") },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ returnTo: "/requests" });
    const user = engine.db
      .query<{ id: string }, []>("SELECT id FROM users WHERE email = 'new@example.org'")
      .get();
    if (user === null) throw new Error("Expected created user");
    expect(
      engine.db
        .query<{ role_id: string; claim: string }, [string]>(
          "SELECT role_id, claim FROM user_mapped_roles WHERE user_id = ?",
        )
        .all(user.id),
    ).toContainEqual({ role_id: "reader", claim: "default role" });
    expect(
      engine.db
        .query("SELECT 1 FROM local_passwords WHERE instance_id = 'pi24' AND username = 'new-user'")
        .get(),
    ).not.toBeNull();
  });
  it("refuses a used verification token", async () => {
    await signup("once");
    const token = mailToken("Verify your email");
    expect(
      (await call(engine, "POST", "/api/email-verification/confirm", { body: { token } })).status,
    ).toBe(200);
    expect(
      (await call(engine, "POST", "/api/email-verification/confirm", { body: { token } })).status,
    ).toBe(410);
  });
  it("rejects a taken username and a short password", async () => {
    expect((await signup("admin")).status).toBe(422);
    expect((await signup("short", "short@example.org", { password: "12345678901" })).status).toBe(
      422,
    );
  });
  it("does not enumerate existing email addresses", async () => {
    const before = engine.db
      .query<{ count: number }, []>("SELECT count(*) AS count FROM pending_sign_ups")
      .get()?.count;
    expect((await signup("other", "tomas.marek@muni.cz")).status).toBe(202);
    expect(
      engine.db.query<{ count: number }, []>("SELECT count(*) AS count FROM pending_sign_ups").get()
        ?.count,
    ).toBe(before);
    expect(engine.outbox.list("mail").at(-1)?.payload).toMatchObject({
      subject: "You already have an account",
      link: "/forgot-password?instance=pi24",
    });
  });
  it("silently ignores a filled honeypot", async () => {
    const before = engine.outbox.list().length;
    expect((await signup("bot", "bot@example.org", { website: "bot" })).status).toBe(202);
    expect(engine.outbox.list()).toHaveLength(before);
    expect(
      engine.db.query("SELECT 1 FROM pending_sign_ups WHERE username = 'bot'").get(),
    ).toBeNull();
  });
  it("limits an email to three verification mails a day", async () => {
    for (let i = 0; i < 3; i++)
      expect((await signup(`daily${i}`, "daily@example.org")).status).toBe(202);
    expect((await signup("daily4", "daily@example.org")).status).toBe(429);
  });
  it("mails and consumes a reset token, and says nothing for unknown email", async () => {
    expect(
      (
        await call(engine, "POST", "/api/password-reset/pi24", {
          body: { email: "lucie.benesova@gmail.com" },
        })
      ).status,
    ).toBe(202);
    const token = mailToken("Set a new password");
    expect(
      (
        await call(engine, "POST", "/api/password-reset/confirm", {
          body: { token, password: "abcdefghijkl" },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await call(engine, "POST", "/api/password-reset/confirm", {
          body: { token, password: "abcdefghijkl" },
        })
      ).status,
    ).toBe(410);
    const count = engine.outbox.list().length;
    expect(
      (
        await call(engine, "POST", "/api/password-reset/pi24", {
          body: { email: "unknown@example.org" },
        })
      ).status,
    ).toBe(202);
    expect(engine.outbox.list()).toHaveLength(count);
  });
  it("routes email verification confirm to confirmEmail", async () => {
    const response = await call(engine, "POST", "/api/email-verification/confirm", {
      body: { token: "missing" },
    });
    expect(response.status).toBe(410);
    expect(((await response.json()) as { code: string }).code).toBe("access.link_expired");
  });
  it("logs the person in after confirming, and accepts their password", async () => {
    await signup("confirmed", "confirmed@example.org");
    const response = await call(engine, "POST", "/api/email-verification/confirm", {
      body: { token: mailToken("Verify your email") },
    });
    const signed = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${cookie(response)}` },
      }),
    );
    expect(((await signed.json()) as { user: { email: string } }).user.email).toBe(
      "confirmed@example.org",
    );
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: "confirmed", password: "abcdefghijkl" },
        })
      ).status,
    ).toBe(204);
  });
  it("ends earlier sessions when a password is reset", async () => {
    const old = cookie(
      await call(engine, "POST", "/api/login/pi24", {
        body: { username: "lbenesova", password: "first" },
      }),
    );
    await call(engine, "POST", "/api/password-reset/pi24", {
      body: { email: "lucie.benesova@gmail.com" },
    });
    const token = mailToken("Set a new password");
    const reset = await call(engine, "POST", "/api/password-reset/confirm", {
      body: { token, password: "newpassword123" },
    });
    expect(reset.status).toBe(204);
    expect(
      (
        await engine.fetch(
          new Request("http://engine.test/api/session", {
            headers: { Cookie: `vera_session=${old}` },
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: "lbenesova", password: "newpassword123" },
        })
      ).status,
    ).toBe(204);
  });
  it("resets a base account with no saved password", async () => {
    expect(
      engine.db
        .query(
          "SELECT 1 FROM local_passwords WHERE instance_id = 'pi24' AND username = 'lbenesova'",
        )
        .get(),
    ).toBeNull();
    expect(
      (
        await call(engine, "POST", "/api/password-reset/pi24", {
          body: { email: "lucie.benesova@gmail.com" },
        })
      ).status,
    ).toBe(202);
    const token = mailToken("Set a new password");
    expect(
      (
        await call(engine, "POST", "/api/password-reset/confirm", {
          body: { token, password: "newpassword123" },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: "lbenesova", password: "anotherpassword" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call(engine, "POST", "/api/login/pi24", {
          body: { username: "lbenesova", password: "newpassword123" },
        })
      ).status,
    ).toBe(204);
  });
  it("expires a verification link when its username was claimed meanwhile", async () => {
    await signup("claimed", "claimed@example.org");
    const token = mailToken("Verify your email");
    engine.db
      .query(
        "INSERT INTO user_identities (user_id, instance_id, external_id, last_login_at) VALUES ('u1', 'pi24', 'claimed', NULL)",
      )
      .run();
    const response = await call(engine, "POST", "/api/email-verification/confirm", {
      body: { token },
    });
    expect(response.status).toBe(410);
    expect(((await response.json()) as { code: string }).code).toBe("access.link_expired");
    expect(
      engine.db.query<{ used_at: string | null }, []>("SELECT used_at FROM pending_sign_ups").get(),
    ).toMatchObject({ used_at: expect.any(String) });
  });
  it("deletes unused pending sign-ups after seven days", async () => {
    await signup("expires", "expires@example.org");
    const token = mailToken("Verify your email");
    engine.clock.advance(7 * 24 * 60 * 60 * 1000 + 60 * 1000);
    expect(engine.jobs.runDue().failed).toBe(0);
    expect(engine.db.query("SELECT 1 FROM pending_sign_ups").get()).toBeNull();
    expect(
      (await call(engine, "POST", "/api/email-verification/confirm", { body: { token } })).status,
    ).toBe(410);
  });
});
