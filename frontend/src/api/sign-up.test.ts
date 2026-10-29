import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { listLoginEntries } from "@/api/login";
import { confirmEmail, requestPasswordReset, resetPassword, signUp } from "@/api/sign-up";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}
describe("local sign-up and password reset", () => {
  it("advertises sign-up only on the configured local form", async () => {
    server.use(...createHandlers("reader"));
    const entries = await listLoginEntries();
    expect(entries.find((x) => x.instanceId === "pi24")).toMatchObject({
      canSignUp: true,
      canResetPassword: true,
    });
    expect(entries.find((x) => x.instanceId === "pi22")).toMatchObject({
      canSignUp: false,
      canResetPassword: false,
    });
  });
  it("signs up, mails, verifies and gives the account its role", async () => {
    server.use(...createHandlers("reader"));
    const prev = [...database.pendingSignUps],
      mails = [...database.systemMail],
      users = [...database.users];
    try {
      await signUp("pi24", {
        name: "New Person",
        email: "new@example.org",
        username: "new-user",
        password: "abcdefghijkl",
        returnTo: "/requests",
      });
      const mail = database.systemMail.at(-1);
      if (mail === undefined) throw new Error("Expected verification mail");
      expect(mail).toMatchObject({
        to: "new@example.org",
        subject: "Verify your email",
        link: expect.stringContaining("/verify-email/"),
      });
      const token = mail.link?.split("/").at(-1);
      if (token === undefined) throw new Error("Expected verification link");
      expect(await confirmEmail(token)).toEqual({ returnTo: "/requests" });
      expect(database.users.at(-1)).toMatchObject({ name: "New Person", email: "new@example.org" });
      const created = database.users.at(-1);
      if (created === undefined) throw new Error("Expected created account");
      expect(database.userAccess[created.id]).toMatchObject({
        handRoleIds: ["reader"],
        identities: [{ instanceId: "pi24", externalId: "new-user" }],
      });
    } finally {
      database.pendingSignUps = prev;
      database.systemMail = mails;
      database.users = users;
      database.userAccess = Object.fromEntries(
        Object.entries(database.userAccess).filter(([id]) => users.some((u) => u.id === id)),
      );
    }
  });
  it("refuses a used verification token", async () => {
    server.use(...createHandlers("reader"));
    const prev = [...database.pendingSignUps];
    try {
      database.pendingSignUps.push({
        token: "used",
        instanceId: "pi24",
        name: "N",
        email: "n@x.org",
        username: "n",
        returnTo: "/",
        createdAt: new Date().toISOString(),
        isUsed: true,
      });
      expect(await statusOf(confirmEmail("used"))).toBe(410);
    } finally {
      database.pendingSignUps = prev;
    }
  });
  it("rejects a taken username and short password", async () => {
    server.use(...createHandlers("reader"));
    expect(
      await statusOf(
        signUp("pi24", {
          name: "N",
          email: "n@x.org",
          username: "admin",
          password: "abcdefghijkl",
        }),
      ),
    ).toBe(422);
    expect(
      await statusOf(
        signUp("pi24", { name: "N", email: "n@x.org", username: "new", password: "12345678901" }),
      ),
    ).toBe(422);
  });
  it("does not enumerate existing email addresses", async () => {
    server.use(...createHandlers("reader"));
    const pending = [...database.pendingSignUps],
      mails = [...database.systemMail];
    try {
      await signUp("pi24", {
        name: "Reader",
        email: "tomas.marek@muni.cz",
        username: "another",
        password: "abcdefghijkl",
      });
      expect(database.pendingSignUps).toHaveLength(pending.length);
      expect(database.systemMail.at(-1)?.subject).toBe("You already have an account");
    } finally {
      database.pendingSignUps = pending;
      database.systemMail = mails;
    }
  });
  it("silently ignores a filled honeypot", async () => {
    server.use(...createHandlers("reader"));
    const pending = [...database.pendingSignUps],
      mails = [...database.systemMail];
    try {
      await signUp("pi24", {
        name: "N",
        email: "n@x.org",
        username: "new",
        password: "abcdefghijkl",
        website: "bot",
      });
      expect(database.pendingSignUps).toEqual(pending);
      expect(database.systemMail).toEqual(mails);
    } finally {
      database.pendingSignUps = pending;
      database.systemMail = mails;
    }
  });
  it("limits an email to three verification mails a day", async () => {
    server.use(...createHandlers("reader"));
    const pending = [...database.pendingSignUps],
      mails = [...database.systemMail];
    try {
      for (let i = 0; i < 3; i++)
        await signUp("pi24", {
          name: "N",
          email: "daily@example.org",
          username: `daily${i}`,
          password: "abcdefghijkl",
        });
      expect(
        await statusOf(
          signUp("pi24", {
            name: "N",
            email: "daily@example.org",
            username: "daily4",
            password: "abcdefghijkl",
          }),
        ),
      ).toBe(429);
    } finally {
      database.pendingSignUps = pending;
      database.systemMail = mails;
    }
  });
  it("mails and consumes a reset token, and says nothing for unknown email", async () => {
    server.use(...createHandlers("reader"));
    const resets = [...database.passwordResets],
      mails = [...database.systemMail];
    try {
      await requestPasswordReset("pi24", "lucie.benesova@gmail.com");
      const mail = database.systemMail.at(-1);
      if (mail === undefined || mail.link === null) throw new Error("Expected reset mail link");
      expect(mail.link).toContain("/reset-password/");
      const token = mail.link.split("/").at(-1);
      if (token === undefined) throw new Error("Expected reset token");
      await resetPassword({ token, password: "abcdefghijkl" });
      expect(await statusOf(resetPassword({ token, password: "abcdefghijkl" }))).toBe(410);
      const before = database.systemMail.length;
      await requestPasswordReset("pi24", "unknown@example.org");
      expect(database.systemMail).toHaveLength(before);
    } finally {
      database.passwordResets = resets;
      database.systemMail = mails;
    }
  });
});
