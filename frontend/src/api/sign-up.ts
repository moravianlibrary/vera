// Local account sign-up and email links (ACCESS-sign-up, ACCESS-verify-email, ACCESS-password-reset).
import type { PasswordReset, SignUp } from "@vera/contract/login";
import { verifiedSchema } from "@vera/contract/login";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { getJson, postJson, postNoContent } from "@/api/http";
import { env } from "@/config/env";
// This is the only app import of a mock type: the endpoint exists only in mock mode.
import type { MockSystemMail } from "@/mocks/sign-up";

const emailBody = (email: string) => ({ email });
export const signUp = (instanceId: string, body: SignUp) =>
  postNoContent(`${apiRoutes.signUp}/${encodeURIComponent(instanceId)}`, body);
export const sendVerificationAgain = (instanceId: string, email: string) =>
  postNoContent(
    `${apiRoutes.emailVerification}/${encodeURIComponent(instanceId)}`,
    emailBody(email),
  );
export const confirmEmail = (token: string) =>
  postJson(`${apiRoutes.emailVerification}/confirm`, { token }, verifiedSchema);
export const requestPasswordReset = (instanceId: string, email: string) =>
  postNoContent(`${apiRoutes.passwordReset}/${encodeURIComponent(instanceId)}`, emailBody(email));
export const resetPassword = (body: PasswordReset) =>
  postNoContent(`${apiRoutes.passwordReset}/confirm`, body);
export function listMockSystemMail(): Promise<MockSystemMail[]> {
  if (env.VITE_API_MODE !== "mock") return Promise.resolve([]);
  return getJson(
    `${env.VITE_API_BASE_URL}/_mock/system-mail`,
    z.array(
      z.object({
        to: z.string(),
        subject: z.string(),
        text: z.string(),
        link: z.string().nullable(),
        sentAt: z.string(),
      }),
    ),
  );
}
