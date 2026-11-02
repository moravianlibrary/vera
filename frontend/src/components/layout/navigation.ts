// The sidebar entries, in navigation.md §1 order. An entry the session holds no grant for is
// absent, never disabled. Holding a permission at any scope reveals the entry.

import type { Session } from "@vera/domain/entities";
import type { Permission } from "@vera/domain/permissions";
import { hasAnyPermission, hasPermission } from "@vera/domain/permissions";

export type NavigationEntryId =
  | "my-documents"
  | "documents"
  | "requests"
  | "validations"
  | "lists"
  | "projects"
  | "categories"
  | "mixes"
  | "intentions"
  | "tasks"
  | "schedules"
  | "access"
  | "plugins"
  | "properties"
  | "hooks"
  | "watchlists";

export interface NavigationEntry {
  readonly id: NavigationEntryId;
  readonly path: string;
  readonly rail: string;
  // The key stays stable when the UI language changes.
  readonly label: string;
  // Shown instead of `label` to someone whose reach is only their own records.
  readonly ownLabel?: string;
  readonly ownUnless?: Permission;
  readonly requires: readonly Permission[];
}

export const navigationEntries: readonly NavigationEntry[] = [
  // Two pages, one per detail (VIEW-own-label): what one asked for, or one's projects asked
  // for, in public detail, and the approved work in staff detail.
  {
    id: "my-documents",
    path: "/my-documents",
    rail: "common:navigation.rail.my-documents",
    label: "common:navigation.entry.my-documents",
    requires: ["request.read_mine"],
  },
  {
    id: "documents",
    path: "/documents",
    rail: "common:navigation.rail.documents",
    label: "common:navigation.entry.documents",
    requires: ["iteration.read"],
  },
  {
    id: "requests",
    path: "/requests",
    rail: "common:navigation.rail.requests",
    label: "common:navigation.entry.requests",
    // Read-only without `request.decide` (VIEW-requests).
    requires: ["request.read"],
  },
  {
    id: "validations",
    path: "/review/documents",
    rail: "common:navigation.rail.validations",
    label: "common:navigation.entry.validations",
    requires: ["validation.approve", "validation.deny", "validation.revoke"],
  },
  {
    id: "lists",
    path: "/lists",
    rail: "common:navigation.rail.lists",
    label: "common:navigation.entry.lists",
    requires: ["list.read"],
  },
  {
    id: "projects",
    path: "/projects",
    rail: "common:navigation.rail.projects",
    label: "common:navigation.entry.projects",
    requires: ["project.read"],
  },
  {
    id: "categories",
    path: "/categories",
    rail: "common:navigation.rail.categories",
    label: "common:navigation.entry.categories",
    requires: ["category.read"],
  },
  {
    id: "mixes",
    path: "/mixes",
    rail: "common:navigation.rail.mixes",
    label: "common:navigation.entry.mixes",
    requires: ["mix.read"],
  },
  {
    id: "intentions",
    path: "/intentions",
    rail: "common:navigation.rail.intentions",
    label: "common:navigation.entry.intentions",
    requires: ["intention.read"],
  },
  {
    id: "tasks",
    path: "/tasks",
    rail: "common:navigation.rail.tasks",
    label: "common:navigation.entry.tasks",
    ownLabel: "common:navigation.entry.tasksOwn",
    ownUnless: "task.read",
    requires: ["task.read_own", "task.read"],
  },
  {
    id: "schedules",
    path: "/schedules",
    rail: "common:navigation.rail.schedules",
    label: "common:navigation.entry.schedules",
    requires: ["task.read"],
  },
  {
    id: "access",
    path: "/access",
    rail: "common:navigation.rail.access",
    label: "common:navigation.entry.access",
    requires: ["access.read"],
  },
  {
    id: "plugins",
    path: "/plugins",
    rail: "common:navigation.rail.plugins",
    label: "common:navigation.entry.plugins",
    requires: ["plugin.read"],
  },
  // DOC-property: defined by an admin only.
  {
    id: "properties",
    path: "/properties",
    rail: "common:navigation.rail.properties",
    label: "common:navigation.entry.properties",
    requires: ["property.define"],
  },
  {
    id: "hooks",
    path: "/hooks",
    rail: "common:navigation.rail.hooks",
    label: "common:navigation.entry.hooks",
    requires: ["hook.read"],
  },
  {
    id: "watchlists",
    path: "/watchlists",
    rail: "common:navigation.rail.watchlists",
    label: "common:navigation.entry.watchlists",
    requires: ["watchlist.manage_system"],
  },
];

export interface VisibleNavigationEntry extends NavigationEntry {
  readonly visibleLabel: string;
}

export function visibleNavigation(session: Session): VisibleNavigationEntry[] {
  return navigationEntries
    .filter((entry) => hasAnyPermission(session, entry.requires))
    .map((entry) => ({ ...entry, visibleLabel: labelFor(entry, session) }));
}

// A nested page may stay addressable even when it has no separate sidebar row.
export function canOpenNavigationEntry(session: Session, entryId: string): boolean {
  const entry = navigationEntries.find((candidate) => candidate.id === entryId);
  return entry !== undefined && hasAnyPermission(session, entry.requires);
}

function labelFor(entry: NavigationEntry, session: Session): string {
  if (entry.ownLabel === undefined || entry.ownUnless === undefined) {
    return entry.label;
  }

  return hasPermission(session, entry.ownUnless) ? entry.label : entry.ownLabel;
}
