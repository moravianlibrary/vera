// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { Group, Role } from "@/mocks/fixtures/access-types";

export const roles: readonly Role[] = [
  {
    id: "reader",
    description: "Proposes and follows their own requests. Holds only self-scoped grants.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_own",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
    ],
  },
  {
    id: "staff",
    description: "Library staff: read every record, fix descriptions.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_own",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "project",
      },
      {
        permission: "project.edit",
        scope: "managed",
      },
      {
        permission: "project.manage_members",
        scope: "managed",
      },
      {
        permission: "project.delete",
        scope: "managed",
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "iteration.edit_descriptive",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
    ],
  },
  {
    id: "curator",
    description:
      "Decides proposals in their proposal custody; validates, classifies and publishes inside their category custody; decides projects.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_own",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "project",
      },
      {
        permission: "project.edit",
        scope: "managed",
      },
      {
        permission: "project.manage_members",
        scope: "managed",
      },
      {
        permission: "project.delete",
        scope: "managed",
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "iteration.edit_descriptive",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "request.decide",
        scope: "custody",
      },
      {
        permission: "validation.approve",
        scope: "custody",
      },
      {
        permission: "validation.deny",
        scope: "custody",
      },
      {
        permission: "validation.revoke",
        scope: "custody",
      },
      {
        permission: "iteration.classify",
        scope: "custody",
      },
      {
        permission: "iteration.cancel",
        scope: "custody",
      },
      {
        permission: "iteration.resume",
        scope: "custody",
      },
      {
        permission: "iteration.publish",
        scope: "custody",
      },
      {
        permission: "addition.read",
        scope: "custody",
      },
      {
        permission: "category.edit",
        scope: "custody",
      },
      {
        permission: "category.grant_custody",
        scope: "custody",
      },
      {
        permission: "project.decide",
        scope: "any",
      },
    ],
  },
  {
    id: "dig-curator",
    description: "Plans the work: lists, intentions, projects.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_own",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "iteration.edit_descriptive",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "list.read",
        scope: "any",
      },
      {
        permission: "list.create",
        scope: "any",
      },
      {
        permission: "list.edit",
        scope: "any",
      },
      {
        permission: "list.delete",
        scope: "any",
      },
      {
        permission: "intention.read",
        scope: "any",
      },
      {
        permission: "intention.edit",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "any",
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.edit",
        scope: "any",
      },
      {
        permission: "project.manage_members",
        scope: "any",
      },
      {
        permission: "project.delete",
        scope: "any",
      },
      {
        permission: "iteration.cancel",
        scope: "any",
      },
      {
        permission: "iteration.resume",
        scope: "any",
      },
    ],
  },
  {
    id: "admin",
    description: "Everything, at any scope.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_own",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "request.decide",
        scope: "any",
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "iteration.edit_descriptive",
        scope: "any",
      },
      {
        permission: "iteration.classify",
        scope: "any",
      },
      {
        permission: "validation.approve",
        scope: "any",
      },
      {
        permission: "validation.deny",
        scope: "any",
      },
      {
        permission: "validation.revoke",
        scope: "any",
      },
      {
        permission: "restriction.overrule",
        scope: "any",
      },
      {
        permission: "iteration.cancel",
        scope: "any",
      },
      {
        permission: "iteration.resume",
        scope: "any",
      },
      {
        permission: "iteration.publish",
        scope: "any",
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "watchlist.manage_shared",
        scope: "any",
      },
      {
        permission: "addition.read",
        scope: "any",
      },
      {
        permission: "addition.retry",
        scope: "any",
      },
      {
        permission: "addition.read_payload",
        scope: "any",
      },
      {
        permission: "list.read",
        scope: "any",
      },
      {
        permission: "list.create",
        scope: "any",
      },
      {
        permission: "list.edit",
        scope: "any",
      },
      {
        permission: "list.delete",
        scope: "any",
      },
      {
        permission: "intention.read",
        scope: "any",
      },
      {
        permission: "intention.edit",
        scope: "any",
      },
      {
        permission: "intention.edit_overall",
        scope: "any",
      },
      {
        permission: "intention.repeat",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "any",
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.edit",
        scope: "any",
      },
      {
        permission: "project.manage_members",
        scope: "any",
      },
      {
        permission: "project.delete",
        scope: "any",
      },
      {
        permission: "project.decide",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "category.edit",
        scope: "any",
      },
      {
        permission: "category.grant_custody",
        scope: "any",
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "task.read",
        scope: "any",
      },
      {
        permission: "task.cancel",
        scope: "any",
      },
      {
        permission: "task.schedule",
        scope: "any",
      },
      {
        permission: "plugin.read",
        scope: "any",
      },
      {
        permission: "plugin.configure",
        scope: "any",
      },
      {
        permission: "plugin.upload_code",
        scope: "any",
      },
      {
        permission: "plugin.run",
        scope: "any",
      },
      {
        permission: "hook.read",
        scope: "any",
      },
      {
        permission: "hook.configure",
        scope: "any",
      },
      {
        permission: "access.read",
        scope: "any",
      },
      {
        permission: "access.manage",
        scope: "any",
      },
    ],
  },
];

export const groups: readonly Group[] = [
  {
    id: "g1",
    name: "Periodicals Curators",
    categoryIds: ["c2"],
    memberIds: ["u1", "u8"],
  },
  {
    id: "g2",
    name: "Digitization Office",
    categoryIds: [],
    memberIds: ["u2", "u9"],
  },
  {
    id: "g3",
    name: "Reading Room",
    categoryIds: [],
    memberIds: ["u4"],
  },
];

export const roleAssignments: Readonly<Record<string, readonly string[]>> = {
  u1: ["curator"],
  u2: ["dig-curator"],
  u3: ["admin", "staff"],
  u4: ["staff"],
  u8: ["curator", "staff"],
  u9: ["staff"],
  u5: ["reader"],
  u6: ["reader"],
  u7: ["reader"],
  u10: [],
  a1: ["reader"],
  a2: ["reader"],
};

export const directCustody: Readonly<Record<string, readonly string[]>> = {
  c4: ["u8"],
};
