// ACCESS-sign-up, ACCESS-verify-email and ACCESS-password-reset for local accounts.
import { endpoints } from "@vera/contract/endpoints";
import { safeReturnTo } from "@vera/contract/return-to";
import { hashOf, openSession, sessionCookie } from "../access/sessions";
import type { Engine } from "../engine";
import type { Endpoint } from "../http/endpoint";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import type { Job } from "../jobs";
import { identityInstance } from "./instances";
import { createLinkedPerson } from "./login";

const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;
const week = 7 * day;

function passwordMinimum(engine: Engine, instanceId: string): number {
  return Number(identityInstance(engine, instanceId)?.configuration.password_min ?? 12);
}

function token(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function configured(engine: Engine, instanceId: string) {
  const instance = identityInstance(engine, instanceId);
  const mail =
    instance !== null &&
    engine.db
      .query(`SELECT 1 FROM plugin_instances i
        JOIN plugin_implementations p ON p.id = i.implementation_id
        WHERE i.id = ? AND p.kind = 'DeliveryChannel' AND i.is_enabled = 1 AND i.is_deleted = 0`)
      .get(instance.configuration.mail_channel);
  return instance?.entry === "form" && instance.configuration.signup === "on" && mail
    ? instance
    : null;
}

function createPending(
  engine: Engine,
  values: {
    instanceId: string;
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    returnTo: string;
  },
) {
  const secret = token();
  const tokenHash = hashOf(secret);
  engine.db
    .query(`INSERT INTO pending_sign_ups
    (token_hash, instance_id, name, email, username, password_hash, return_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      tokenHash,
      values.instanceId,
      values.name,
      values.email,
      values.username,
      values.passwordHash,
      values.returnTo,
      engine.clock.now().toISOString(),
    );
  engine.outbox.send("mail", values.email, {
    subject: "Verify your email",
    link: `/verify-email/${secret}`,
  });
  engine.jobs.enqueue("sign-up.expire", new Date(engine.clock.now().getTime() + week), {
    tokenHash,
  });
}

const signUp = implement(endpoints.signUp, async ({ engine, params, body }) => {
  const instance = configured(engine, params.instanceId);
  if (instance === null) return problem(404, "There is no sign-up for this instance.", {});
  if (body.website) return new Response(null, { status: 202 });
  if (body.password.length < passwordMinimum(engine, instance.id))
    return problem(422, "The password is too short.", { code: "access.password_short" });
  const now = engine.clock.now();
  if (
    engine.db
      .query("SELECT 1 FROM user_identities WHERE instance_id = ? AND external_id = ?")
      .get(instance.id, body.username) ||
    engine.db
      .query(`SELECT 1 FROM pending_sign_ups
      WHERE instance_id = ? AND username = ? AND used_at IS NULL AND created_at >= ?`)
      .get(instance.id, body.username, new Date(now.getTime() - week).toISOString())
  )
    return problem(422, "That username is taken.", { code: "access.username_taken" });
  // Outbox has no recipient/subject filter; count these verification mails directly in SQL.
  const count =
    engine.db
      .query<{ count: number }, [string, string, string]>(`SELECT count(*) AS count FROM outbox
    WHERE channel = 'mail' AND lower(recipient) = lower(?) AND json_extract(payload, '$.subject') = ? AND sent_at >= ?`)
      .get(body.email, "Verify your email", new Date(now.getTime() - day).toISOString())?.count ??
    0;
  if (count >= 3)
    return problem(429, "Too many verification emails.", {
      code: "access.too_many_verification_emails",
    });
  if (
    engine.db
      .query("SELECT 1 FROM users WHERE email IS NOT NULL AND lower(email) = lower(?)")
      .get(body.email)
  ) {
    engine.outbox.send("mail", body.email, {
      subject: "You already have an account",
      link: `/forgot-password?instance=${encodeURIComponent(instance.id)}`,
    });
    return new Response(null, { status: 202 });
  }
  createPending(engine, {
    instanceId: instance.id,
    name: body.name,
    email: body.email,
    username: body.username,
    passwordHash: await Bun.password.hash(body.password),
    returnTo: safeReturnTo(body.returnTo ?? null),
  });
  return new Response(null, { status: 202 });
});

const sendVerificationAgain = implement(
  endpoints.sendVerificationAgain,
  ({ engine, params, body }) => {
    const row = engine.db
      .query<
        {
          instance_id: string;
          name: string;
          email: string;
          username: string;
          password_hash: string;
          return_to: string;
        },
        [string, string]
      >(`SELECT instance_id, name, email, username, password_hash, return_to
    FROM pending_sign_ups WHERE instance_id = ? AND lower(email) = lower(?) AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1`)
      .get(params.instanceId, body.email);
    if (row !== null) {
      engine.db
        .query(
          "UPDATE pending_sign_ups SET used_at = ? WHERE instance_id = ? AND lower(email) = lower(?) AND used_at IS NULL",
        )
        .run(engine.clock.now().toISOString(), params.instanceId, body.email);
      createPending(engine, {
        instanceId: row.instance_id,
        name: row.name,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        returnTo: row.return_to,
      });
    }
    return new Response(null, { status: 202 });
  },
);

const confirmEmail = implement(endpoints.confirmEmail, ({ engine, body }) => {
  const row = engine.db
    .query<
      {
        token_hash: string;
        instance_id: string;
        name: string;
        email: string;
        username: string;
        password_hash: string;
        return_to: string;
        created_at: string;
        used_at: string | null;
      },
      [string]
    >("SELECT * FROM pending_sign_ups WHERE token_hash = ?")
    .get(hashOf(body.token));
  if (
    row === null ||
    row.used_at !== null ||
    engine.clock.now().getTime() - Date.parse(row.created_at) > day
  )
    return problem(410, "This link has expired.", { code: "access.link_expired" });
  const conflict = engine.db
    .query(`SELECT 1 FROM user_identities WHERE instance_id = ? AND external_id = ?
      UNION ALL SELECT 1 FROM users WHERE email IS NOT NULL AND lower(email) = lower(?) LIMIT 1`)
    .get(row.instance_id, row.username, row.email);
  if (conflict !== null) {
    // A user may have claimed this username or email while the verification link was outstanding.
    engine.db
      .query("UPDATE pending_sign_ups SET used_at = ? WHERE token_hash = ?")
      .run(engine.clock.now().toISOString(), row.token_hash);
    return problem(410, "This link has expired.", { code: "access.link_expired" });
  }
  const userId = engine.db.transaction(() => {
    engine.db
      .query("UPDATE pending_sign_ups SET used_at = ? WHERE token_hash = ?")
      .run(engine.clock.now().toISOString(), row.token_hash);
    const instance = identityInstance(engine, row.instance_id);
    if (instance === null) throw new Error("The sign-up identity instance is no longer available.");
    const id = createLinkedPerson(
      engine,
      instance,
      { externalId: row.username, name: row.name, email: row.email },
      engine.clock.now().toISOString(),
    );
    engine.db
      .query(`INSERT INTO local_passwords (instance_id, username, hash) VALUES (?, ?, ?)
        ON CONFLICT (instance_id, username) DO UPDATE SET hash = excluded.hash`)
      .run(row.instance_id, row.username, row.password_hash);
    return id;
  })();
  const session = openSession(engine, userId, row.instance_id);
  return new Response(JSON.stringify({ returnTo: row.return_to }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie(session, engine.development),
    },
  });
});

const requestPasswordReset = implement(
  endpoints.requestPasswordReset,
  ({ engine, params, body }) => {
    const found = engine.db
      .query<{ user_id: string }, [string, string]>(`SELECT u.id AS user_id FROM users u
    JOIN user_identities i ON i.user_id = u.id WHERE i.instance_id = ? AND lower(u.email) = lower(?) LIMIT 1`)
      .get(params.instanceId, body.email);
    if (found !== null) {
      const secret = token();
      engine.db
        .query(
          "INSERT INTO password_resets (token_hash, user_id, instance_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(hashOf(secret), found.user_id, params.instanceId, engine.clock.now().toISOString());
      engine.outbox.send("mail", body.email, {
        subject: "Set a new password",
        link: `/reset-password/${secret}`,
      });
    }
    return new Response(null, { status: 202 });
  },
);

const resetPassword = implement(endpoints.resetPassword, async ({ engine, body }) => {
  const row = engine.db
    .query<
      {
        token_hash: string;
        user_id: string;
        instance_id: string;
        created_at: string;
        used_at: string | null;
      },
      [string]
    >("SELECT * FROM password_resets WHERE token_hash = ?")
    .get(hashOf(body.token));
  if (
    row === null ||
    row.used_at !== null ||
    engine.clock.now().getTime() - Date.parse(row.created_at) > hour
  )
    return problem(410, "This link has expired.", { code: "access.link_expired" });
  if (body.password.length < passwordMinimum(engine, row.instance_id))
    return problem(422, "The password is too short.", { code: "access.password_short" });
  const identity = engine.db
    .query<{ external_id: string }, [string, string]>(
      "SELECT external_id FROM user_identities WHERE user_id = ? AND instance_id = ?",
    )
    .get(row.user_id, row.instance_id);
  if (identity === null)
    return problem(410, "This link has expired.", { code: "access.link_expired" });
  const passwordHash = await Bun.password.hash(body.password);
  engine.db.transaction(() => {
    engine.db
      .query("UPDATE password_resets SET used_at = ? WHERE token_hash = ?")
      .run(engine.clock.now().toISOString(), row.token_hash);
    engine.db
      .query(`INSERT INTO local_passwords (instance_id, username, hash) VALUES (?, ?, ?)
        ON CONFLICT (instance_id, username) DO UPDATE SET hash = excluded.hash`)
      .run(row.instance_id, identity.external_id, passwordHash);
    engine.db.query("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
  })();
  const session = openSession(engine, row.user_id, row.instance_id);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": sessionCookie(session, engine.development) },
  });
});

export const signUpEndpoints: readonly Endpoint[] = [
  confirmEmail,
  sendVerificationAgain,
  resetPassword,
  requestPasswordReset,
  signUp,
];

export function registerSignUpJobs(engine: Engine): void {
  engine.jobs.register("sign-up.expire", (job: Job) => {
    const tokenHash = (job.payload as { tokenHash: string }).tokenHash;
    engine.db
      .query("DELETE FROM pending_sign_ups WHERE token_hash = ? AND used_at IS NULL")
      .run(tokenHash);
  });
}
