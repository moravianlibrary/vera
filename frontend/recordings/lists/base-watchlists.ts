const profiles = [
  "admin",
  "curator",
  "digitization",
  "staff",
  "reader",
  "no-access",
  "project-user",
] as const;
const watchlistRead = (as: (typeof profiles)[number]) => ({
  as,
  method: "GET",
  path: "/api/watchlists?view=documents",
  compare: "body",
});
const subscription = {
  endpoint: "https://push.example/recording-browser",
  keys: { p256dh: "recording-key", auth: "recording-secret" },
};
const draft = {
  names: { cs: "Záznamový seznam", en: "Recording watchlist" },
  view: "documents",
  audience: { kind: "personal" },
  filter: { q: "recording-watchlist-unique" },
};
const sharedDraft = {
  ...draft,
  names: { cs: "Sdílený záznamový seznam", en: "Recording shared watchlist" },
  audience: { kind: "everyone" },
};
const invalidFilter = { ...draft, filter: { status: "Available" } };
const reachDraft = { ...draft, watchlistId: null };
const sharedReachDraft = { ...sharedDraft, watchlistId: null };
export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "decisions",
  scenarios: [
    {
      name: "reads",
      calls: [
        ...profiles.flatMap((as) => [
          watchlistRead(as),
          { as, method: "GET", path: "/api/session/watchlist-channels", compare: "body" },
          { as, method: "GET", path: "/api/session/push-devices", compare: "body" },
        ]),
      ],
    },
    {
      name: "admin-watchlist-and-push-acts",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists/reach",
          requestBody: reachDraft,
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists",
          requestBody: draft,
          compare: "body",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1",
          requestBody: {
            names: { cs: "Přejmenovaný záznamový seznam", en: "Recording watchlist renamed" },
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1/viewer",
          requestBody: { position: 2, channels: { pi18: true } },
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists/W-u3-documents-1/seen",
          requestBody: {},
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/watchlists?view=documents", compare: "body" },
        {
          as: "admin",
          method: "POST",
          path: "/api/session/push-devices",
          requestBody: subscription,
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/session/push-devices", compare: "body" },
        {
          as: "reader",
          method: "POST",
          path: "/api/watchlists/reach",
          requestBody: reachDraft,
          compare: "code",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/watchlists",
          requestBody: draft,
          compare: "code",
        },
        {
          as: "curator",
          method: "PATCH",
          path: "/api/watchlists/W-shared-2",
          requestBody: { names: { en: "Changed" } },
          compare: "code",
        },
        { as: "curator", method: "DELETE", path: "/api/watchlists/W-shared-2", compare: "code" },
        {
          as: "admin",
          method: "DELETE",
          path: "/api/watchlists/W-u3-documents-1",
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/watchlists?view=documents", compare: "body" },
      ],
    },
    {
      name: "watchlist-refusals",
      calls: [
        {
          as: "reader",
          method: "GET",
          path: "/api/watchlists?view=documents&mode=manage-system",
          compare: "code",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/watchlists/reach",
          requestBody: sharedReachDraft,
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists/reach",
          requestBody: { ...invalidFilter, watchlistId: null },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists",
          requestBody: invalidFilter,
          compare: "code",
        },
        { as: "admin", method: "POST", path: "/api/watchlists", requestBody: {}, compare: "code" },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists/reach",
          requestBody: {},
          compare: "code",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/watchlists",
          requestBody: sharedDraft,
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists",
          requestBody: { ...draft, copyOf: "not-a-watchlist" },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/watchlists",
          requestBody: {
            ...draft,
            names: { en: "Duplicate personal filter" },
            filter: { priority: "Urgent,High", copy: "None" },
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1",
          requestBody: { filter: { status: "Available" } },
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1",
          requestBody: {},
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1/viewer",
          requestBody: { channels: { pi18: "yes" } },
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-shared-1",
          requestBody: { audience: { kind: "personal" } },
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-1",
          requestBody: { audience: { kind: "everyone" } },
          compare: "code",
        },
        {
          as: "admin",
          method: "PATCH",
          path: "/api/watchlists/W-u3-documents-2",
          requestBody: { filter: { priority: "Urgent,High", copy: "None" } },
          compare: "code",
        },
      ],
    },
    {
      name: "czech-watchlist-name",
      calls: [
        {
          as: "admin",
          method: "GET",
          path: "/api/watchlists?view=documents",
          acceptLanguage: "cs",
          compare: "body",
        },
      ],
    },
  ],
} as const;
