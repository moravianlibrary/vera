// The sidebar entries, in navigation.md §1 order. An entry the session holds no grant for is
// absent, never disabled. Holding a permission at any scope reveals the entry.

import type { Session } from "@vera/domain/entities";
import type { Permission } from "@vera/domain/permissions";
import { hasAnyPermission, hasPermission } from "@vera/domain/permissions";

export interface NavigationEntry {
  readonly id: string;
  readonly path: string;
  readonly rail: string;
  // TODO(rrandiak): move labels to i18n once it is set up.
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
    rail: "MD",
    label: "My Documents",
    requires: ["request.read_mine"],
  },
  {
    id: "documents",
    path: "/documents",
    rail: "Do",
    label: "Documents",
    requires: ["iteration.read"],
  },
  {
    id: "requests",
    path: "/requests",
    rail: "Rq",
    label: "Requests",
    // Read-only without `request.decide` (VIEW-requests).
    requires: ["request.read"],
  },
  {
    id: "validations",
    path: "/review/documents",
    rail: "DV",
    label: "Documents Validations",
    requires: ["validation.approve", "validation.deny", "validation.revoke"],
  },
  { id: "lists", path: "/lists", rail: "DL", label: "Digitization Lists", requires: ["list.read"] },
  {
    id: "projects",
    path: "/projects",
    rail: "Pj",
    label: "Projects",
    requires: ["project.read"],
  },
  {
    id: "categories",
    path: "/categories",
    rail: "Ca",
    label: "Categories",
    requires: ["category.read"],
  },
  { id: "mixes", path: "/mixes", rail: "Mx", label: "Category mixes", requires: ["mix.read"] },
  {
    id: "intentions",
    path: "/intentions",
    rail: "In",
    label: "Intentions",
    requires: ["intention.read"],
  },
  {
    id: "tasks",
    path: "/tasks",
    rail: "Ta",
    label: "Tasks",
    ownLabel: "My Tasks",
    ownUnless: "task.read",
    requires: ["task.read_own", "task.read"],
  },
  { id: "schedules", path: "/schedules", rail: "Sc", label: "Schedules", requires: ["task.read"] },
  {
    id: "access",
    path: "/access",
    rail: "UM",
    label: "Users management",
    requires: ["access.read"],
  },
  { id: "plugins", path: "/plugins", rail: "Pl", label: "Plugins", requires: ["plugin.read"] },
  // DOC-property: defined by an admin only.
  {
    id: "properties",
    path: "/properties",
    rail: "Pr",
    label: "Properties",
    requires: ["property.define"],
  },
  { id: "hooks", path: "/hooks", rail: "Ho", label: "Hooks", requires: ["hook.read"] },
  {
    id: "watchlists",
    path: "/watchlists",
    rail: "WL",
    label: "System watchlists",
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
