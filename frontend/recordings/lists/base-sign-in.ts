export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "none",
  scenarios: [
    {
      name: "login-entries-and-session-for-every-profile",
      calls: [
        ...[
          "admin",
          "curator",
          "digitization",
          "staff",
          "reader",
          "no-access",
          "project-user",
        ].flatMap((as) => [
          { as, method: "GET", path: "/api/login", compare: "body" },
          { as, method: "GET", path: "/api/session", compare: "body" },
        ]),
      ],
    },
    {
      name: "local-sign-in-and-logout",
      calls: [
        {
          method: "POST",
          path: "/api/login/pi24",
          requestBody: { username: "lbenesova", password: "pass" },
          compare: "code",
        },
        { as: "reader", method: "DELETE", path: "/api/session/logout", compare: "code" },
        { as: "reader", method: "GET", path: "/api/session", compare: "code" },
      ],
    },
    {
      name: "provider-login-mock-only",
      calls: [{ method: "POST", path: "/api/login/pi22/mock", requestBody: {}, compare: "code" }],
    },
    {
      name: "local-sign-up-and-email-links",
      calls: [
        {
          method: "POST",
          path: "/api/signup/pi24",
          requestBody: {
            name: "New Person",
            email: "new@example.org",
            username: "new-person",
            password: "abcdefghijkl",
            returnTo: "/requests",
          },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/signup/pi24",
          requestBody: {
            name: "Existing Person",
            email: "taken@example.org",
            username: "admin",
            password: "abcdefghijkl",
          },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/signup/pi24",
          requestBody: {
            name: "New Person",
            email: "short@example.org",
            username: "short-password",
            password: "12345678901",
          },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/email-verification/pi24",
          requestBody: { email: "new@example.org" },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/email-verification/confirm",
          requestBody: { token: "unknown-token" },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/password-reset/pi24",
          requestBody: { email: "lucie.benesova@gmail.com" },
          compare: "code",
        },
        {
          method: "POST",
          path: "/api/password-reset/confirm",
          requestBody: { token: "unknown-token", password: "abcdefghijkl" },
          compare: "code",
        },
      ],
    },
  ],
} as const;
