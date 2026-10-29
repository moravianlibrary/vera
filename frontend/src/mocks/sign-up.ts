// ACCESS-sign-up, ACCESS-verify-email and ACCESS-password-reset in the in-memory mock.
import type { PasswordReset, SignUp } from "@vera/contract/login";
import { safeReturnTo } from "@vera/contract/return-to";
import { addLocalAccountUser } from "@/mocks/access";
import { database } from "@/mocks/database";
import type { Outcome } from "@/mocks/mutations";
import { mockNow } from "@/mocks/today";

// An account waiting for its email to be verified (ACCESS-sign-up).
export interface PendingSignUp {
  token: string;
  instanceId: string;
  name: string;
  email: string;
  username: string;
  returnTo: string;
  createdAt: string;
  isUsed: boolean;
}
export interface PasswordResetToken {
  token: string;
  userId: string;
  createdAt: string;
  isUsed: boolean;
}
// What the mock would have mailed; the pages show it in mock mode.
export interface MockSystemMail {
  to: string;
  subject: string;
  text: string;
  link: string | null;
  sentAt: string;
}

const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;
const localInstance = (instanceId: string) =>
  database.pluginInstances.find(
    (instance) =>
      instance.id === instanceId &&
      instance.isEnabled &&
      instance.implementationId === "pt22" &&
      instance.settings?.kind === "Identity",
  );
function mail(to: string, subject: string, link: string | null): void {
  // The mock sends no mail; pages expose these in-memory messages for the demo.
  database.systemMail.push({ to, subject, text: subject, link, sentAt: mockNow().toISOString() });
}
function refusal(status: 404 | 410 | 422 | 429, code?: string): Outcome<never> {
  return {
    refusal: {
      status,
      ...(code === undefined ? {} : { code }),
      message: code ?? "Request refused",
    },
  };
}

export function signUp(instanceId: string, body: SignUp): Outcome<null> {
  const instance = localInstance(instanceId);
  if (
    instance === undefined ||
    instance.configuration.signup !== "on" ||
    instance.configuration.mail_channel === undefined
  )
    return refusal(404);
  if (body.website) return { value: null };
  const minimum = Number(instance.configuration.password_min ?? 12);
  if (body.password.length < minimum) return refusal(422, "access.password_short");
  if (
    database.users.some((user) =>
      database.userAccess[user.id]?.identities.some(
        (identity) => identity.instanceId === instanceId && identity.externalId === body.username,
      ),
    )
  )
    return refusal(422, "access.username_taken");
  const since = mockNow().getTime() - day;
  if (
    database.systemMail.filter(
      (item) =>
        item.to.toLowerCase() === body.email.toLowerCase() &&
        item.subject === "Verify your email" &&
        Date.parse(item.sentAt) >= since,
    ).length >= 3
  )
    return refusal(429);
  if (database.users.some((user) => user.email?.toLowerCase() === body.email.toLowerCase())) {
    mail(body.email, "You already have an account", "/forgot-password");
    return { value: null };
  }
  const token = crypto.randomUUID();
  database.pendingSignUps.push({
    token,
    instanceId,
    name: body.name,
    email: body.email,
    username: body.username,
    returnTo: safeReturnTo(body.returnTo ?? null),
    createdAt: mockNow().toISOString(),
    isUsed: false,
  });
  mail(body.email, "Verify your email", `/verify-email/${token}`);
  return { value: null };
}
export function sendVerificationAgain(instanceId: string, email: string): Outcome<null> {
  const pending = database.pendingSignUps.find(
    (item) =>
      item.instanceId === instanceId &&
      item.email.toLowerCase() === email.toLowerCase() &&
      !item.isUsed,
  );
  if (pending !== undefined) {
    pending.isUsed = true;
    const next = {
      ...pending,
      token: crypto.randomUUID(),
      createdAt: mockNow().toISOString(),
      isUsed: false,
    };
    database.pendingSignUps.push(next);
    mail(email, "Verify your email", `/verify-email/${next.token}`);
  }
  return { value: null };
}
export function confirmEmail(token: string): Outcome<{ returnTo: string }> {
  const pending = database.pendingSignUps.find((item) => item.token === token);
  if (
    pending === undefined ||
    pending.isUsed ||
    mockNow().getTime() - Date.parse(pending.createdAt) > day
  )
    return refusal(410, "access.link_expired");
  pending.isUsed = true;
  const instance = localInstance(pending.instanceId);
  const roles =
    instance?.settings?.kind === "Identity" && instance.settings.defaultRoleId
      ? [instance.settings.defaultRoleId]
      : [];
  addLocalAccountUser(pending.name, pending.email, pending.instanceId, pending.username, roles);
  return { value: { returnTo: pending.returnTo } };
}
export function requestPasswordReset(instanceId: string, email: string): Outcome<null> {
  const hasIdentity = database.users.some(
    (user) =>
      user.email?.toLowerCase() === email.toLowerCase() &&
      database.userAccess[user.id]?.identities.some(
        (identity) => identity.instanceId === instanceId,
      ),
  );
  if (hasIdentity) {
    const token = crypto.randomUUID();
    database.passwordResets.push({
      token,
      userId:
        database.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? "",
      createdAt: mockNow().toISOString(),
      isUsed: false,
    });
    mail(email, "Set a new password", `/reset-password/${token}`);
  }
  return { value: null };
}
export function resetPassword(body: PasswordReset): Outcome<null> {
  const token = database.passwordResets.find((item) => item.token === body.token);
  if (
    token === undefined ||
    token.isUsed ||
    mockNow().getTime() - Date.parse(token.createdAt) > hour
  )
    return refusal(410, "access.link_expired");
  const identity = database.userAccess[token.userId]?.identities.find(
    (item) => item.instanceId === localInstance(item.instanceId)?.id,
  );
  const instance = identity === undefined ? undefined : localInstance(identity.instanceId);
  if (body.password.length < Number(instance?.configuration.password_min ?? 12))
    return refusal(422, "access.password_short");
  token.isUsed = true;
  return { value: null };
}
