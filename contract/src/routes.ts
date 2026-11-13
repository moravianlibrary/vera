// API resource paths, relative to the configured base URL. The client and the mock server both
// read them from here, so a route is renamed in one place.

export const apiRoutes = {
  session: "/session",
  login: "/login",
  signUp: "/signup",
  emailVerification: "/email-verification",
  passwordReset: "/password-reset",
  sessionLogout: "/session/logout",
  sessionAccount: "/session/account",
  userSettings: "/session/settings",
  notificationHooks: "/session/notification-hooks",
  // WATCH-push: the browsers this person allowed to be notified in, and the key they subscribe
  // with.
  pushDevices: "/session/push-devices",
  // WATCH-delivery: the Delivery channel instances that can reach this person.
  watchlistChannels: "/session/watchlist-channels",
  notificationPreferences: "/notification-preferences",
  users: "/users",
  categories: "/categories",
  // Categories, the page: the tree with its numbers, custody and Overall's mix, read-only.
  categoryIndex: "/categories/overview",
  projects: "/projects",
  // Projects, the page: every project the caller sees with its numbers worked out.
  projectIndex: "/projects/overview",
  groups: "/groups",
  // Intentions, the page: every intention the caller sees with what it counts.
  intentionIndex: "/intentions/overview",
  intentions: "/intentions",
  mixes: "/mixes",
  // What a draft would count and the mix it would read, before it is saved.
  intentionPreview: "/intentions/preview",
  intentionTemplates: "/intention-templates",
  lists: "/lists",
  digitizationLists: "/digitization-lists",
  digitizationListPool: "/digitization-lists/pool",
  listGenerators: "/digitization-lists/generators",
  listGeneration: "/digitization-lists/generate",
  // The intentions a draft can be shaped by.
  listShapes: "/digitization-lists/shapes",
  // What a draft counts towards, and its fill against one intention's mix.
  listReading: "/digitization-lists/reading",
  batches: "/batches",
  documents: "/documents",
  iterations: "/iterations",
  watchlists: "/watchlists",
  // Who an audience would reach, before a watchlist is shared with it.
  watchlistReach: "/watchlists/reach",
  // Roles by name, for choosing who a watchlist is shared with.
  roles: "/roles",
  proposalSettings: "/proposals/settings",
  proposalEntry: "/proposals/entry",
  proposalLookup: "/proposals/lookup",
  // ACT-ways-in: searching the catalogs that can be searched, reading a record link in one that
  // cannot, reading a photo, and reading the barcode on a photo where the browser cannot.
  proposalCatalogSearch: "/proposals/catalog-search",
  proposalRecordLink: "/proposals/record-link",
  proposalPhoto: "/proposals/photo",
  proposalBarcode: "/proposals/barcode",
  proposals: "/proposals",
  // Remaining rate limit count for the current user (checked before submit).
  proposalRateLimit: "/proposals/rate-limit",
  requests: "/requests",
  requestCustodies: "/request-custodies",
  validations: "/validations",
  messageChannels: "/message-channels",
  messageHandOff: "/messages/hand-off",
  messageSend: "/messages/send",
  // Every instance by name, for other records to point at; and where a new one is made.
  pluginInstances: "/plugin-instances",
  // Plugins, the page: every implementation and instance with what it declares and runs.
  plugins: "/plugins",
  pluginInstanceReset: "/plugin-instances/:id/reset",
  pluginImplementations: "/plugin-implementations",
  // A package read before it is installed.
  pluginUploads: "/plugin-implementations/uploads",
  tasks: "/tasks",
  // The sidebar's panel: only what is running.
  runningTasks: "/tasks/running",
  taskRetention: "/tasks/retention",
  schedules: "/schedules",
  hooks: "/hooks",
  // DOC-property: the definitions, written on the Properties page.
  properties: "/properties",
  hookPreview: "/hooks/preview",
  // Users & Groups, the page: every user, role, group and request custody with what links them.
  access: "/access",
  accessRoles: "/access/roles",
  accessUsers: "/access/users",
  accessGroups: "/access/groups",
  accessCustodies: "/access/custodies",
} as const;

export function documentRoute(documentId: string): string {
  return `${apiRoutes.documents}/${encodeURIComponent(documentId)}`;
}

export function documentRelinkRoute(documentId: string): string {
  return `${documentRoute(documentId)}/relink`;
}

export function categoryRoute(categoryId: string): string {
  return `${apiRoutes.categories}/${encodeURIComponent(categoryId)}`;
}

// What is done to one category besides editing it: its custody set, what removing or refining it
// would change, and refining it (permissions.md §3, Categories).
export const categoryActions = ["custody", "impact", "refine"] as const;
export type CategoryAction = (typeof categoryActions)[number];

export function categoryActionRoute(categoryId: string, action: CategoryAction): string {
  return `${categoryRoute(categoryId)}/${action}`;
}

export function projectRoute(projectId: string): string {
  return `${apiRoutes.projects}/${encodeURIComponent(projectId)}`;
}

export function intentionRoute(intentionId: string): string {
  return `${apiRoutes.intentions}/${encodeURIComponent(intentionId)}`;
}

export function mixRoute(mixId: string): string {
  return `${apiRoutes.mixes}/${encodeURIComponent(mixId)}`;
}

export function digitizationListRoute(listId: string): string {
  return `${apiRoutes.digitizationLists}/${encodeURIComponent(listId)}`;
}

export function digitizationListMemberRoute(listId: string, iterationId: string): string {
  return `${digitizationListRoute(listId)}/items/${encodeURIComponent(iterationId)}`;
}

export function watchlistRoute(watchlistId: string): string {
  return `${apiRoutes.watchlists}/${encodeURIComponent(watchlistId)}`;
}

export function watchlistViewerRoute(watchlistId: string): string {
  return `${watchlistRoute(watchlistId)}/viewer`;
}

export function watchlistSeenRoute(watchlistId: string): string {
  return `${watchlistRoute(watchlistId)}/seen`;
}

export function notificationPreferencePath(token: string): string {
  return `${apiRoutes.notificationPreferences}/${encodeURIComponent(token)}`;
}

export function requestRoute(documentId: string): string {
  return `${apiRoutes.requests}/${encodeURIComponent(documentId)}`;
}

export function proposalDecisionRoute(documentId: string, decision: "approve" | "decline"): string {
  return `${requestRoute(documentId)}/${decision}`;
}

// The caller takes back their own ask on the document while it waits (ACT-withdraw).
export function askWithdrawalRoute(documentId: string): string {
  return `${requestRoute(documentId)}/withdraw`;
}

// Everything open a batch asked for, approved at once (status-model.md §2.8).
export function proposalBulkApprovalRoute(batchId: string): string {
  return `${apiRoutes.requests}/batches/${encodeURIComponent(batchId)}/approve`;
}

// The verdicts on one iteration's defects, each its own permission (permissions.md §3).
export const verdictActions = ["accept", "deny", "revoke"] as const;
export type VerdictAction = (typeof verdictActions)[number];

export function validationRoute(iterationId: string): string {
  return `${apiRoutes.validations}/${encodeURIComponent(iterationId)}`;
}

export function verdictRoute(iterationId: string, action: VerdictAction): string {
  return `${validationRoute(iterationId)}/${action}`;
}

// What may be done to an iteration from the Documents and Validations panes: each is its own
// action, so the server checks each permission against the iteration's category (permissions.md
// §3). Entering a page count runs the checks again; a recheck runs them over the record as the
// catalog has it now.
export const iterationActions = [
  "reclassify",
  "publish",
  "page-count",
  "recheck",
  "cancel",
  "resume",
  "overrule",
] as const;
export type IterationAction = (typeof iterationActions)[number];

export function iterationActionRoute(iterationId: string, action: IterationAction): string {
  return `${apiRoutes.iterations}/${encodeURIComponent(iterationId)}/${action}`;
}

export function iterationLinkRoute(
  iterationId: string,
  linkId: string,
  action?: "replace" | "primary",
): string {
  const base = `${apiRoutes.iterations}/${encodeURIComponent(iterationId)}/links/${encodeURIComponent(linkId)}`;
  return action === undefined ? base : `${base}/${action}`;
}

// Every failed addition of a batch, retried at once: the batch is the unit retried
// (ACT-retry-batch).
export function batchRetryRoute(batchId: string): string {
  return `${apiRoutes.batches}/${encodeURIComponent(batchId)}/retry`;
}

export function taskRoute(runId: string): string {
  return `${apiRoutes.tasks}/${encodeURIComponent(runId)}`;
}

// What is done to one run, and its log as a file.
export const taskActions = ["cancel", "rerun", "log"] as const;
export type TaskAction = (typeof taskActions)[number];

export function taskActionRoute(runId: string, action: TaskAction): string {
  return `${taskRoute(runId)}/${action}`;
}

export function scheduleRoute(scheduleId: string): string {
  return `${apiRoutes.schedules}/${encodeURIComponent(scheduleId)}`;
}

// Pause it with a reason, resume it, or run it now by hand.
export const scheduleActions = ["pause", "resume", "run"] as const;
export type ScheduleAction = (typeof scheduleActions)[number];

export function scheduleActionRoute(scheduleId: string, action: ScheduleAction): string {
  return `${scheduleRoute(scheduleId)}/${action}`;
}

// One record of Users & Groups, and what is set on it whole: a user's hand-set roles, groups and
// identities; a group's or a custody's members. And what deleting a role or a custody would do,
// and a person suspended and restored (ACCESS-suspend).
export const accessRecordKinds = [
  "roles",
  "users",
  "groups",
  "custodies",
  "identity-instances",
] as const;
export type AccessRecordKind = (typeof accessRecordKinds)[number];

export function accessRecordRoute(kind: AccessRecordKind, recordId: string): string {
  return `${apiRoutes.access}/${kind}/${recordId.startsWith(":") ? recordId : encodeURIComponent(recordId)}`;
}

export const accessRecordActions = [
  "roles",
  "groups",
  "identities",
  "members",
  "impact",
  "suspend",
  "restore",
  "default-role",
] as const;
export type AccessRecordAction = (typeof accessRecordActions)[number];

export function accessRecordActionRoute(
  kind: AccessRecordKind,
  recordId: string,
  action: AccessRecordAction,
): string {
  return `${accessRecordRoute(kind, recordId)}/${action}`;
}

export function pluginInstanceRoute(instanceId: string): string {
  return `${apiRoutes.pluginInstances}/${encodeURIComponent(instanceId)}`;
}

// Switch it on or off, say what switching it off stops, run it now, or move it to the newest
// version installed.
export const pluginInstanceActions = ["enable", "disable", "impact", "run", "upgrade"] as const;
export type PluginInstanceAction = (typeof pluginInstanceActions)[number];

export function pluginInstanceActionRoute(
  instanceId: string,
  action: PluginInstanceAction,
): string {
  return `${pluginInstanceRoute(instanceId)}/${action}`;
}

export function pluginUploadInstallRoute(uploadId: string): string {
  return `${apiRoutes.pluginUploads}/${encodeURIComponent(uploadId)}/install`;
}
