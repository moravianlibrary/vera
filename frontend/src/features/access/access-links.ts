// What the selected record on Users & Groups is connected to (docs/demos/shared/page-access.js
// `links`): a tag on each connected record saying how, and the lines between the columns, which
// always run left to right: role → user → group, custody or shared watchlist. A role held only
// through a mapping is a dashed line, as is a custody reached through a group. A shared watchlist
// lights up the groups and roles in its audience and the people it reaches, and they light it up.

import type { AccessIndex } from "@vera/contract/access";
import {
  custodyMembersOf,
  heldRolesOf,
  holdersOf,
  isMappedOnly,
  requestCustodyOf,
} from "@vera/domain/access";
import type { LinkedLine, LinkedTag } from "@/components/linked-columns";
import { linkKeyOf } from "@/components/linked-columns";
import type { AccessSelection } from "@/features/access/access-view";
import { viaText, waysShortText } from "@/features/access/access-words";
import { i18n } from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "access", ...options });

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

  // The shared watchlists whose audience names the role or the group.
  const tagSharedWith = (field: "roleIds" | "groupIds", recordId: string) => {
    for (const watchlist of index.sharedWatchlists) {
      if (watchlist.audience.kind === "some" && watchlist.audience[field].includes(recordId)) {
        tag("watchlists", watchlist.id, t("links.sharedWithIt"));
      }
    }
  };

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
        tag("groups", groupId, t("via.member"));
        line(["users", user.id], ["groups", groupId]);
      }

      for (const { custodyId, via } of requestCustodyOf(user.id, index.groups, index.custodies)) {
        tag("custodies", custodyId, viaText(via, groupNameOf));
        line(["users", user.id], ["custodies", custodyId], via !== null);
      }

      for (const watchlist of index.sharedWatchlists) {
        if (watchlist.reachedUserIds.includes(user.id)) {
          tag("watchlists", watchlist.id, t("links.seesIt"));
          line(["users", user.id], ["watchlists", watchlist.id]);
        }
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

      tagSharedWith("roleIds", selection.id);
      break;
    case "groups": {
      const group = index.groups.find((candidate) => candidate.id === selection.id);
      for (const userId of group?.memberIds ?? []) {
        tag("users", userId, t("via.member"));
        line(["users", userId], ["groups", selection.id]);
      }

      for (const custody of index.custodies.filter((candidate) =>
        candidate.groupIds.includes(selection.id),
      )) {
        tag("custodies", custody.id, t("links.heldByGroup"));
      }

      tagSharedWith("groupIds", selection.id);
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
          via.includes(null)
            ? t("via.member")
            : t("links.viaGroups", { groups: groupIds.map(groupNameOf).join(", ") }),
        );
        if (via.includes(null)) {
          line(["users", userId], ["custodies", custody.id]);
        }

        for (const groupId of groupIds) {
          line(["users", userId], ["groups", groupId], true);
        }
      }

      for (const groupId of custody.groupIds) {
        tag("groups", groupId, t("links.memberOfIt"));
      }

      break;
    }
    case "watchlists": {
      const watchlist = index.sharedWatchlists.find((candidate) => candidate.id === selection.id);
      if (watchlist === undefined) {
        break;
      }

      for (const userId of watchlist.reachedUserIds) {
        tag("users", userId, t("links.seesIt"));
        line(["users", userId], ["watchlists", watchlist.id]);
      }

      for (const userId of watchlist.outOfViewUserIds) {
        tag("users", userId, t("links.cannotOpenView"));
      }

      if (watchlist.audience.kind === "some") {
        for (const roleId of watchlist.audience.roleIds) {
          tag("roles", roleId, t("links.inAudience"));
        }

        for (const groupId of watchlist.audience.groupIds) {
          tag("groups", groupId, t("links.inAudience"));
        }
      }

      break;
    }
  }

  return { tags, lines };
}
