// What may be done on Users & Groups, and the dialog each act opens (view-catalog.md *Users &
// Groups*; docs/demos/shared/page-access.js). Everything is `access.manage`'s but a shared
// watchlist, which is `watchlist.manage_shared`'s (*Share…*, *Rename…*, *Edit filter* in its own
// view, *Delete…*); without either the page has no acts at all. The header makes new records: a
// local account first, then a role, a group and a custody, folded into "…" past the tier's cap
// (one on a phone, as the demo's *New…*). Each record has its own: a person's roles, groups and
// another identity (not for an agent, which never logs in); a role's grants, a copy and its
// delete; a group's name and members; a custody's name, members and delete, never the
// fallback's.
// TODO(rrandiak): labels move to i18n.

import type { AccessIndex } from "@/api/access";
import type { ViewAction } from "@/components/actions/action-bar";
import type { AccessNotice } from "@/features/access/access-dialogs";
import {
  CustodyEditorDialog,
  CustodyMembersDialog,
  DeleteCustodyDialog,
  GroupEditorDialog,
  GroupMembersDialog,
  LinkIdentityDialog,
  NewLocalAccountDialog,
  UserGroupsDialog,
  UserRolesDialog,
} from "@/features/access/access-dialogs";
import type { AccessNames } from "@/features/access/access-records";
import type { AccessSelection } from "@/features/access/access-view";
import { DeleteRoleDialog, RoleEditorDialog } from "@/features/access/role-dialogs";
import {
  DeleteSharedWatchlistDialog,
  RenameSharedWatchlistDialog,
  ShareSharedWatchlistDialog,
  watchlistHrefOf,
} from "@/features/access/watchlist-dialogs";

export type AccessDialog =
  | { kind: "newAccount" | "newRole" | "newGroup" | "newCustody" }
  | {
      kind:
        | "userRoles"
        | "userGroups"
        | "linkIdentity"
        | "editRole"
        | "copyRole"
        | "deleteRole"
        | "editGroup"
        | "groupMembers"
        | "editCustody"
        | "custodyMembers"
        | "deleteCustody"
        | "shareWatchlist"
        | "renameWatchlist"
        | "deleteWatchlist";
      id: string;
    };

type Open = (dialog: AccessDialog) => void;

export function headerActionsFor(open: Open): ViewAction[] {
  return [
    {
      id: "new-account",
      label: "New local account",
      isPrimary: true,
      onSelect: () => open({ kind: "newAccount" }),
    },
    { id: "new-role", label: "New role", onSelect: () => open({ kind: "newRole" }) },
    { id: "new-group", label: "New group", onSelect: () => open({ kind: "newGroup" }) },
    {
      id: "new-custody",
      label: "New proposal custody set",
      onSelect: () => open({ kind: "newCustody" }),
    },
  ];
}

// Which of the two the caller holds.
export interface AccessMay {
  canManageAccess: boolean;
  canManageShared: boolean;
}

export function recordActionsFor(
  index: AccessIndex,
  selection: AccessSelection,
  open: Open,
  { canManageAccess, canManageShared }: AccessMay,
): ViewAction[] {
  if (selection.kind === "watchlists") {
    const watchlist = index.sharedWatchlists.find((candidate) => candidate.id === selection.id);
    if (!canManageShared || watchlist === undefined) {
      return [];
    }

    return [
      {
        id: "share",
        label: "Share…",
        onSelect: () => open({ kind: "shareWatchlist", id: watchlist.id }),
      },
      {
        id: "rename",
        label: "Rename…",
        onSelect: () => open({ kind: "renameWatchlist", id: watchlist.id }),
      },
      { id: "edit-filter", label: "Edit filter", href: watchlistHrefOf(watchlist) },
      {
        id: "delete",
        label: "Delete…",
        isDestructive: true,
        onSelect: () => open({ kind: "deleteWatchlist", id: watchlist.id }),
      },
    ];
  }

  if (!canManageAccess) {
    return [];
  }

  const { id } = selection;
  const act = (kind: Extract<AccessDialog, { id: string }>["kind"], label: string) => ({
    id: kind,
    label,
    onSelect: () => open({ kind, id }),
  });
  switch (selection.kind) {
    case "users": {
      const user = index.users.find((candidate) => candidate.id === id);
      return [
        act("userRoles", "Roles…"),
        act("userGroups", "Groups…"),
        ...(user?.kind === "person" ? [act("linkIdentity", "Link identity…")] : []),
      ];
    }
    case "roles":
      return [
        act("editRole", "Edit grants…"),
        act("copyRole", "Duplicate"),
        { ...act("deleteRole", "Delete…"), isDestructive: true },
      ];
    case "groups":
      return [act("editGroup", "Edit…"), act("groupMembers", "Members…")];
    case "custodies": {
      const custody = index.custodies.find((candidate) => candidate.id === id);
      return [
        act("editCustody", "Edit…"),
        act("custodyMembers", "Members…"),
        ...(custody?.isFallback === false
          ? [{ ...act("deleteCustody", "Delete…"), isDestructive: true }]
          : []),
      ];
    }
  }
}

interface AccessDialogViewProps {
  dialog: AccessDialog;
  index: AccessIndex;
  names: AccessNames;
  onClose: () => void;
  // What was done, and the record to select after, when it moves.
  onDone: (notice: AccessNotice, selection?: AccessSelection) => void;
}

export function AccessDialogView({ dialog, index, names, onClose, onDone }: AccessDialogViewProps) {
  const common = { isOpen: true, onClose, index, names };
  const recordOf = <Record extends { id: string }>(records: readonly Record[]) =>
    "id" in dialog ? records.find((record) => record.id === dialog.id) : undefined;
  const user = recordOf(index.users);
  const role = recordOf(index.roles);
  const group = recordOf(index.groups);
  const custody = recordOf(index.custodies);
  const watchlist = recordOf(index.sharedWatchlists);
  const watchlistProps = { onClose, onDone: (notice: AccessNotice) => onDone(notice) };

  switch (dialog.kind) {
    case "newAccount":
      return (
        <NewLocalAccountDialog
          {...common}
          onCreated={(notice, id) => onDone(notice, { kind: "users", id })}
        />
      );
    case "newRole":
      return (
        <RoleEditorDialog
          {...common}
          source={{ kind: "new" }}
          onSaved={(notice, id) => onDone(notice, { kind: "roles", id })}
        />
      );
    case "newGroup":
      return (
        <GroupEditorDialog
          {...common}
          group={null}
          onSaved={(notice, id) => onDone(notice, { kind: "groups", id })}
        />
      );
    case "newCustody":
      return (
        <CustodyEditorDialog
          {...common}
          custody={null}
          onSaved={(notice, id) => onDone(notice, { kind: "custodies", id })}
        />
      );
    case "userRoles":
      return user === undefined ? null : (
        <UserRolesDialog {...common} user={user} onSaved={(notice) => onDone(notice)} />
      );
    case "userGroups":
      return user === undefined ? null : (
        <UserGroupsDialog {...common} user={user} onSaved={(notice) => onDone(notice)} />
      );
    case "linkIdentity":
      return user === undefined ? null : (
        <LinkIdentityDialog {...common} user={user} onSaved={(notice) => onDone(notice)} />
      );
    case "editRole":
    case "copyRole":
      return role === undefined ? null : (
        <RoleEditorDialog
          {...common}
          source={{ kind: dialog.kind === "editRole" ? "edit" : "copy", role }}
          onSaved={(notice, id) => onDone(notice, { kind: "roles", id })}
        />
      );
    case "deleteRole":
      return role === undefined ? null : (
        <DeleteRoleDialog
          {...common}
          role={role}
          onDeleted={(notice) => onDone(notice, firstUserOf(index))}
        />
      );
    case "editGroup":
      return group === undefined ? null : (
        <GroupEditorDialog {...common} group={group} onSaved={(notice) => onDone(notice)} />
      );
    case "groupMembers":
      return group === undefined ? null : (
        <GroupMembersDialog {...common} group={group} onSaved={(notice) => onDone(notice)} />
      );
    case "editCustody":
      return custody === undefined ? null : (
        <CustodyEditorDialog {...common} custody={custody} onSaved={(notice) => onDone(notice)} />
      );
    case "custodyMembers":
      return custody === undefined ? null : (
        <CustodyMembersDialog {...common} custody={custody} onSaved={(notice) => onDone(notice)} />
      );
    case "shareWatchlist":
      return watchlist === undefined ? null : (
        <ShareSharedWatchlistDialog {...watchlistProps} watchlist={watchlist} />
      );
    case "renameWatchlist":
      return watchlist === undefined ? null : (
        <RenameSharedWatchlistDialog {...watchlistProps} watchlist={watchlist} />
      );
    case "deleteWatchlist":
      return watchlist === undefined ? null : (
        <DeleteSharedWatchlistDialog
          onClose={onClose}
          watchlist={watchlist}
          onDone={(notice) => onDone(notice, firstUserOf(index))}
        />
      );
    case "deleteCustody": {
      const fallback = index.custodies.find((candidate) => candidate.isFallback);
      return custody === undefined ? null : (
        <DeleteCustodyDialog
          {...common}
          custody={custody}
          onDeleted={(notice) =>
            onDone(
              notice,
              fallback === undefined ? undefined : { kind: "custodies", id: fallback.id },
            )
          }
        />
      );
    }
  }
}

function firstUserOf(index: AccessIndex): AccessSelection | undefined {
  const first = index.users[0];
  return first === undefined ? undefined : { kind: "users", id: first.id };
}
