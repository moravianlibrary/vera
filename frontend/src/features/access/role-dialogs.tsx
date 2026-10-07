// A role's editor and its delete (view-catalog.md *Users & Groups*; docs/demos/shared/
// page-access.js `editRole`, `delRole`; component-interfaces.md §6.5). The editor sets a scope
// per permission, only from those the permission takes, *own* for a self-scoped one; New role
// and Duplicate open it empty or copied. A role people hold is saved whole after a second step
// saying what changes and whom it reaches, each holder with what they actually gain or lose once
// their other roles are counted. It refuses to leave nobody able to manage access. Deleting says
// first, from the server, what each holder keeps and which identity mappings stop giving
// anything.
// TODO(rrandiak): labels move to i18n.

import { useId } from "react";
import type { AccessIndex, RoleDraft } from "@/api/access";
import { createRole, deleteRole, saveRole } from "@/api/access";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { SetEditorDialog } from "@/components/dialogs/set-editor-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessUser, GrantChange, PersonReached, Role } from "@/domain/access";
import {
  grantChangeOf,
  holdersOf,
  managersOf,
  roleChangeReachOf,
  roleNameOf,
} from "@/domain/access";
import type { Grant, HeldScope, Permission, PermissionEntry } from "@/domain/permissions";
import { permissionCatalog, permissionGroups, permissionKeys } from "@/domain/permissions";
import type { AccessNotice } from "@/features/access/access-dialogs";
import type { AccessNames } from "@/features/access/access-records";
import { permissionLines, scopeLabelOf, waysShortText } from "@/features/access/access-words";
import { accessInvalidations, useRoleImpactQuery } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { plural } from "@/lib/plural";

const refusalTexts = {
  "access.last_manager": "Nobody else could manage access after this.",
  "access.name_taken": "There is already a role with that name.",
  403: "You may no longer change roles.",
};

const noScope = "none";

// What the editor starts from: nothing, the role itself, or a copy of it.
export type RoleSource = { kind: "new" } | { kind: "edit" | "copy"; role: Role };

interface RoleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  index: AccessIndex;
  source: RoleSource;
  onSaved: (notice: AccessNotice, roleId: string) => void;
}

export function RoleEditorDialog({ isOpen, onClose, index, source, onSaved }: RoleEditorProps) {
  const id = useId();
  const role = source.kind === "new" ? null : source.role;
  const isCopy = source.kind === "copy";
  const isNew = source.kind !== "edit";
  const stored: RoleDraft = {
    name: role === null ? "" : isCopy ? `${role.name}-copy` : role.name,
    description: role?.description ?? "",
    grants: role?.grants ?? [],
  };
  const save = useActionMutation({
    call: (draft: RoleDraft) =>
      isNew || role === null ? createRole(draft) : saveRole({ roleId: role.id, draft }),
    invalidates: accessInvalidations,
    refusalTexts,
  });

  const invalidReasonOf = ([draft]: readonly RoleDraft[]): string | null => {
    if (draft === undefined || draft.name.trim() === "") {
      return "A role needs a name.";
    }

    const name = roleNameOf(draft.name);
    if (index.roles.some((other) => other.name === name && (isNew || other.id !== role?.id))) {
      return `There is already a role called ${name}.`;
    }

    if (!isNew && role !== null) {
      const roles = index.roles.map((other) =>
        other.id === role.id ? { ...other, grants: draft.grants } : other,
      );
      if (managersOf(index.users, roles).length === 0) {
        return "Nobody else could manage access after this: keep access.manage, or give it to another role first.";
      }
    }

    return null;
  };

  const reachOf = ([draft]: readonly RoleDraft[]) => {
    if (draft === undefined || isNew || role === null) {
      return null;
    }

    const change = grantChangeOf(role.grants, draft.grants);
    const reached = roleChangeReachOf(index.users, index.roles, role.id, draft.grants);
    if (change.added.length + change.removed.length === 0 || reached.length === 0) {
      return null;
    }

    return {
      submitLabel: "Save role",
      body: <RoleReach change={change} reached={reached} />,
    };
  };

  return (
    <SetEditorDialog<RoleDraft>
      isOpen={isOpen}
      onClose={onClose}
      title={
        role === null ? "New role" : isCopy ? `Duplicate ${role.name}` : `Edit role ${role.name}`
      }
      description="A role's name and the scope it grants each permission at"
      width="wide"
      entries={[stored]}
      renderEntries={([draft], onChange) =>
        draft === undefined ? null : (
          <RoleFields id={id} draft={draft} onChange={(next) => onChange([next])} />
        )
      }
      summaryOf={([draft]) =>
        draft === undefined ? null : (
          <p className="text-xs text-muted-foreground">
            {plural(draft.grants.length, "grant")}.{" "}
            {isNew &&
              "Nobody holds it until you give it to somebody, or an Identity mapping names it."}
          </p>
        )
      }
      invalidReasonOf={invalidReasonOf}
      reachOf={reachOf}
      submitLabel={isNew ? "Create role" : "Save role"}
      onSave={async ([draft]) => {
        if (draft === undefined) {
          throw new Error("The role editor has one draft");
        }

        const result = await save.run(draft);
        if (result.isDone) {
          const holderCount = holdersOf(index.users, result.value.id).length;
          onSaved(
            isNew
              ? {
                  title: `Role ${result.value.name} created`,
                  text: "Give it to somebody, or name it in an Identity mapping, to take effect.",
                }
              : {
                  title: `Role ${result.value.name} saved`,
                  text:
                    holderCount === 0
                      ? "Nobody holds it yet."
                      : `${plural(holderCount, "person holds", "people hold")} it: the change is theirs now.`,
                },
            result.value.id,
          );
        }

        return result;
      }}
    />
  );
}

function RoleFields({
  id,
  draft,
  onChange,
}: {
  id: string;
  draft: RoleDraft;
  onChange: (next: RoleDraft) => void;
}) {
  const scopeOf = (permission: Permission) =>
    draft.grants.find((grant) => grant.permission === permission)?.scope;
  const setScope = (permission: Permission, scope: Grant["scope"] | undefined) =>
    onChange({
      ...draft,
      grants: [
        ...draft.grants.filter((grant) => grant.permission !== permission),
        ...(scope === undefined ? [] : [{ permission, scope }]),
      ].toSorted(
        (first, second) =>
          permissionKeys.indexOf(first.permission) - permissionKeys.indexOf(second.permission),
      ),
    });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            placeholder="e.g. maps-curator"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-description`}>What it is for</Label>
          <Input
            id={`${id}-description`}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick the scope each permission reaches. <i>own</i> is the holder's own records, with no
        scope to choose; <i>managed</i> is a project they manage.
      </p>
      <div className="gap-8 md:columns-2">
        {permissionGroups.map((group) => (
          <div key={group} className="mb-3 break-inside-avoid">
            <h4 className="border-b pb-1 text-xs font-semibold">{group}</h4>
            {permissionKeys
              .filter((permission) => permissionCatalog[permission].group === group)
              .map((permission) => (
                <PermissionRow
                  key={permission}
                  id={`${id}-${permission}`}
                  permission={permission}
                  scope={scopeOf(permission)}
                  onChange={(scope) => setScope(permission, scope)}
                />
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

function PermissionRow({
  id,
  permission,
  scope,
  onChange,
}: {
  id: string;
  permission: Permission;
  // Undefined when not granted.
  scope: Grant["scope"] | undefined;
  onChange: (scope: Grant["scope"] | undefined) => void;
}) {
  const { scopes } = permissionCatalog[permission] as PermissionEntry;
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5">
      <label htmlFor={id} className="min-w-0 text-xs">
        <span className="block font-mono text-[0.6875rem]">{permission}</span>
        <span className="block text-muted-foreground">{permissionLines[permission]}</span>
      </label>
      {scopes === null ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs">
          <Checkbox
            id={id}
            checked={scope === null}
            onCheckedChange={(isChecked) => onChange(isChecked === true ? null : undefined)}
          />
          own
        </span>
      ) : (
        <Select
          value={scope ?? noScope}
          onValueChange={(value) => onChange(value === noScope ? undefined : (value as HeldScope))}
        >
          <SelectTrigger id={id} size="sm" className="w-28 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noScope}>—</SelectItem>
            {scopes.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// The second step: what changes, and what each holder gains or loses for it.
function RoleReach({
  change,
  reached,
}: {
  change: GrantChange;
  reached: readonly PersonReached<AccessUser>[];
}) {
  const grantText = (grant: Grant) =>
    `${grant.permission}${grant.scope === null ? "" : `@${grant.scope}`}`;
  return (
    <div className="grid gap-3">
      <p>
        <b className="font-semibold">
          {plural(change.added.length + change.removed.length, "change")}
        </b>
        {change.added.length > 0 && (
          <>
            {" "}
            · adds or widens{" "}
            <span className="font-mono text-xs">{change.added.map(grantText).join(", ")}</span>
          </>
        )}
        {change.removed.length > 0 && (
          <>
            {" "}
            · removes{" "}
            <span className="font-mono text-xs">
              {change.removed.map(({ permission }) => permission).join(", ")}
            </span>
          </>
        )}
      </p>
      <p>
        It reaches <b className="font-semibold">{plural(reached.length, "person", "people")}</b> at
        once:
      </p>
      <ul className="grid gap-1.5">
        {reached.map(({ user, ways, gains, loses }) => (
          <li key={user.id} className="border-b pb-1.5 text-xs last:border-b-0">
            <span className="font-medium">{user.name}</span>{" "}
            <span className="text-muted-foreground">({waysShortText(ways)})</span>
            <span className="block text-muted-foreground">
              {gains.length + loses.length === 0
                ? "Nothing changes for them: another role of theirs holds the same."
                : [
                    gains.length > 0
                      ? `gains ${gains.map((held) => `${held.permission} (${scopeLabelOf(held.scope)})`).join(", ")}`
                      : null,
                    loses.length > 0
                      ? `loses ${loses.map((held) => held.permission).join(", ")}`
                      : null,
                  ]
                    .filter((part) => part !== null)
                    .join("; ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- delete

export function DeleteRoleDialog({
  isOpen,
  onClose,
  role,
  names,
  onDeleted,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  names: AccessNames;
  onDeleted: (notice: AccessNotice) => void;
}) {
  const { data: impact } = useRoleImpactQuery(role.id, isOpen);
  const remove = useActionMutation({
    call: deleteRole,
    invalidates: accessInvalidations,
    refusalTexts,
  });

  const consequences: Consequence[] | undefined =
    impact === undefined
      ? undefined
      : [
          impact.holders.length === 0
            ? { text: "Nobody holds it." }
            : {
                text: `It is held by ${plural(impact.holders.length, "person", "people")}. They lose what only this role gave them.`,
              },
          ...impact.holders.map(
            ({ userId, keptRoleIds }): Consequence =>
              keptRoleIds.length === 0
                ? {
                    text: `${names.user(userId)} is left with no role, and sees nothing.`,
                    tone: "amber",
                  }
                : {
                    text: `${names.user(userId)} keeps ${keptRoleIds.map(names.role).join(", ")}.`,
                  },
          ),
          ...impact.mappings.map(
            ({ instanceId, claim }): Consequence => ({
              text: `${names.instance(instanceId)} maps ${claim ?? "everyone first seen there"} to it. That mapping stops giving anything, and shows a warning on Plugins until it is changed.`,
            }),
          ),
          ...(impact.leavesNoManager
            ? [{ text: "Nobody else could manage access after this.", tone: "red" as const }]
            : []),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${role.name}?`}
      description={`What deleting the role ${role.name} takes from whom`}
      consequences={consequences}
      confirmLabel="Delete role"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(role.id);
        if (result.isDone) {
          onDeleted({
            title: `Role ${role.name} deleted`,
            text:
              impact === undefined || impact.holders.length === 0
                ? "Nobody held it."
                : `${plural(impact.holders.length, "person", "people")} affected.`,
          });
        }

        return result;
      }}
    />
  );
}
