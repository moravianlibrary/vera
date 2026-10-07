// What the selected record on Users & Groups is connected to (docs/demos/shared/page-access.js
// `links`): a tag on each connected record saying how, and the lines between the columns, which
// always run left to right: role → user → group or custody. A role held only through a mapping
// is a dashed line, as is a custody reached through a group.
// TODO(rrandiak): labels move to i18n.

import type { AccessIndex } from "@/api/access";
import type { LinkedLine, LinkedTag } from "@/components/linked-columns";
import { linkKeyOf } from "@/components/linked-columns";
import {
  custodyMembersOf,
  heldRolesOf,
  holdersOf,
  isMappedOnly,
  proposalCustodyOf,
} from "@/domain/access";
import type { AccessSelection } from "@/features/access/access-view";
import { viaText, waysShortText } from "@/features/access/access-words";

export interface AccessLinks {
  tags: Map<string, LinkedTag>;
  lines: LinkedLine[];
}

export function linksOf(index: AccessIndex, selection: AccessSelection): AccessLinks {
  const tags = new Map<string, LinkedTag>();
  const lines: LinkedLine[] = [];
  const groupNameOf = (groupId: string) =>
    index.groups.find((group) => group.id === groupId)?.name ?? groupId;
  const tag = (kind: string, id: string, text: string, isDirect = false) =>
    tags.set(linkKeyOf(kind, id), { text, isDirect });
  const line = (from: [string, string], to: [string, string], isDashed = false) =>
    lines.push({ from: linkKeyOf(...from), to: linkKeyOf(...to), isDashed });

  switch (selection.kind) {
    case "users": {
      const user = index.users.find((candidate) => candidate.id === selection.id);
      if (user === undefined) {
        break;
      }

      for (const { roleId, ways } of heldRolesOf(user)) {
        tag(
          "roles",
          roleId,
          waysShortText(ways),
          ways.some((way) => way.by === "hand"),
        );
        line(["roles", roleId], ["users", user.id], isMappedOnly(ways));
      }

      for (const groupId of user.groupIds) {
        tag("groups", groupId, "member");
        line(["users", user.id], ["groups", groupId]);
      }

      for (const { custodyId, via } of proposalCustodyOf(user.id, index.groups, index.custodies)) {
        tag("custodies", custodyId, viaText(via, groupNameOf));
        line(["users", user.id], ["custodies", custodyId], via !== null);
      }

      break;
    }
    case "roles":
      for (const { user, ways } of holdersOf(index.users, selection.id)) {
        tag(
          "users",
          user.id,
          waysShortText(ways),
          ways.some((way) => way.by === "hand"),
        );
        line(["roles", selection.id], ["users", user.id], isMappedOnly(ways));
      }

      break;
    case "groups": {
      const group = index.groups.find((candidate) => candidate.id === selection.id);
      for (const userId of group?.memberIds ?? []) {
        tag("users", userId, "member");
        line(["users", userId], ["groups", selection.id]);
      }

      for (const custody of index.custodies.filter((candidate) =>
        candidate.groupIds.includes(selection.id),
      )) {
        tag("custodies", custody.id, "held by this group");
      }

      break;
    }
    case "custodies": {
      const custody = index.custodies.find((candidate) => candidate.id === selection.id);
      if (custody === undefined) {
        break;
      }

      for (const { userId, via } of custodyMembersOf(custody, index.groups)) {
        const groupIds = via.filter((way) => way !== null);
        tag(
          "users",
          userId,
          via.includes(null) ? "member" : `via ${groupIds.map(groupNameOf).join(", ")}`,
        );
        if (via.includes(null)) {
          line(["users", userId], ["custodies", custody.id]);
        }

        for (const groupId of groupIds) {
          line(["users", userId], ["groups", groupId], true);
        }
      }

      for (const groupId of custody.groupIds) {
        tag("groups", groupId, "member of it");
      }

      break;
    }
  }

  return { tags, lines };
}
