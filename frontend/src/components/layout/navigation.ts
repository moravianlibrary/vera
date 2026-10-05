// The sidebar entries, in navigation.md §1 order. An entry the session holds no grant for is
// absent, never disabled. Holding a permission at any scope reveals the entry.

import type { Session } from "@/domain/entities";
import type { Permission } from "@/domain/permissions";
import { hasAnyPermission, hasPermission } from "@/domain/permissions";

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
  {
    id: "documents",
    path: "/documents",
    rail: "Do",
    label: "Documents",
    ownLabel: "My Documents",
    ownUnless: "iteration.read",
    requires: ["request.read_own", "iteration.read"],
  },
  {
    id: "proposals",
    path: "/review/proposals",
    rail: "Pr",
    label: "Proposals",
    requires: ["request.decide"],
  },
  {
    id: "validations",
    path: "/review/documents",
    rail: "DV",
    label: "Documents Validations",
    requires: ["validation.approve"],
  },
  { id: "lists", path: "/lists", rail: "DL", label: "Digitization Lists", requires: ["list.read"] },
  {
    id: "projects",
    path: "/projects",
    rail: "Pj",
    label: "Projects",
    requires: ["project.read", "project.decide"],
  },
  {
    id: "categories",
    path: "/categories",
    rail: "Ca",
    label: "Categories",
    requires: ["category.read"],
  },
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
  { id: "access", path: "/access", rail: "UG", label: "Users & Groups", requires: ["access.read"] },
  { id: "plugins", path: "/plugins", rail: "Pl", label: "Plugins", requires: ["plugin.read"] },
  { id: "hooks", path: "/hooks", rail: "Ho", label: "Hooks", requires: ["hook.read"] },
];

export interface VisibleNavigationEntry extends NavigationEntry {
  readonly visibleLabel: string;
}

export function visibleNavigation(session: Session): VisibleNavigationEntry[] {
  return navigationEntries
    .filter((entry) => hasAnyPermission(session, entry.requires))
    .map((entry) => ({ ...entry, visibleLabel: labelFor(entry, session) }));
}

function labelFor(entry: NavigationEntry, session: Session): string {
  if (entry.ownLabel === undefined || entry.ownUnless === undefined) {
    return entry.label;
  }

  return hasPermission(session, entry.ownUnless) ? entry.label : entry.ownLabel;
}
