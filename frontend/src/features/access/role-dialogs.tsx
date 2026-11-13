// A role's editor and its delete (view-catalog.md *Users & Groups*; docs/demos/shared/
// page-access.js `editRole`, `delRole`; component-interfaces.md §6.5). The editor sets a scope
// per permission, only from those the permission takes, *own* for a self-scoped one, and ticks
// what a permission needs with it (PERM-requires); New role
// and Duplicate open it empty or copied. A role people hold is saved whole after a second step
// saying what changes and whom it reaches, each holder with what they actually gain or lose once
// their other roles are counted. It refuses to leave nobody able to manage access. Deleting says
// first, from the server, what each holder keeps and which identity mappings stop giving
// anything.

import type { AccessIndex, RoleDraft } from "@vera/contract/access";
import type { AccessUser, GrantChange, PersonReached, Role } from "@vera/domain/access";
import {
  grantChangeOf,
  holdersOf,
  managersOf,
  roleChangeReachOf,
  roleNameOf,
} from "@vera/domain/access";
import { namesAfterEdit } from "@vera/domain/names";
import type { CatalogScope, Grant, Permission } from "@vera/domain/permissions";
import {
  byCatalogOrder,
  catalogEntryOf,
  grantScopeOf,
  isSelfScoped,
  missingRequirementsOf,
  permissionGroups,
  permissionKeys,
  withRequirements,
} from "@vera/domain/permissions";
import { editPermissionOf } from "@vera/domain/properties";
import { useId } from "react";
import { useTranslation } from "react-i18next";
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
import type { AccessNotice } from "@/features/access/access-dialogs";
import type { AccessNames } from "@/features/access/access-records";
import { permissionLineOf, waysShortText } from "@/features/access/access-words";
import { accessInvalidations, useRoleImpactQuery } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { i18n } from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "access", ...options });

const refusalTexts = {
  "access.last_manager": t("role.refusal.lastManager"),
  "access.name_taken": t("role.refusal.nameTaken"),
  403: t("role.refusal.forbidden"),
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
  const language = i18n.language.startsWith("cs") ? "cs" : "en";
  const stored: RoleDraft = {
    names:
      role === null
        ? { [language]: "" }
        : {
            ...role.names,
            ...(isCopy ? { [language]: `${role.names[language] ?? role.name}-copy` } : {}),
          },
    description: role?.description ?? "",
    grants: role?.grants ?? [],
    proposalBatchLimit: role === null ? 10 : role.proposalBatchLimit,
    proposalDailyLimit: role === null ? 300 : role.proposalDailyLimit,
  };
  const save = useActionMutation({
    call: (draft: RoleDraft) =>
      isNew || role === null ? createRole(draft) : saveRole({ roleId: role.id, draft }),
    invalidates: accessInvalidations,
    refusalTexts,
  });

  const invalidReasonOf = ([draft]: readonly RoleDraft[]): string | null => {
    if (draft === undefined || (draft.names[language] ?? "").trim() === "") {
      return t("role.validation.nameRequired");
    }
    if (
      draft.proposalBatchLimit !== null &&
      (!Number.isInteger(draft.proposalBatchLimit) || draft.proposalBatchLimit < 0)
    ) {
      return t("role.validation.submissionLimit");
    }
    if (
      draft.proposalDailyLimit !== null &&
      (!Number.isInteger(draft.proposalDailyLimit) || draft.proposalDailyLimit < 0)
    ) {
      return t("role.validation.dailyLimit");
    }

    const [missing] = missingRequirementsOf(draft.grants);
    if (missing !== undefined) {
      const { grant, needs } = missing;
      const at = needs.scope === null ? "" : ` (${t(`record.scope.${needs.scope}`)})`;
      return t("role.validation.permissionNeeds", {
        permission: grant.permission,
        needs: needs.permission,
        scope: at,
        action: grant.permission,
      });
    }

    const name = roleNameOf(draft.names[language] ?? "");
    if (
      index.roles.some(
        (other) =>
          roleNameOf(other.names[language] ?? "") === name && (isNew || other.id !== role?.id),
      )
    ) {
      return t("role.validation.nameTaken", { name });
    }

    if (!isNew && role !== null) {
      const roles = index.roles.map((other) =>
        other.id === role.id ? { ...other, grants: draft.grants } : other,
      );
      if (managersOf(index.users, roles).length === 0) {
        return t("role.validation.lastManager");
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
    const grantsChanged = change.added.length + change.removed.length > 0;
    const batchLimitChanged = draft.proposalBatchLimit !== role.proposalBatchLimit;
    const dailyLimitChanged = draft.proposalDailyLimit !== role.proposalDailyLimit;
    const holders = holdersOf(index.users, role.id);
    if ((!grantsChanged && !batchLimitChanged && !dailyLimitChanged) || holders.length === 0) {
      return null;
    }

    return {
      submitLabel: t("role.save"),
      body: (
        <>
          {grantsChanged && reached.length > 0 && <RoleReach change={change} reached={reached} />}
          {batchLimitChanged && (
            <p className="text-sm">
              {t("role.submissionLimitChanges", { count: holders.length })}
              {draft.proposalBatchLimit === null
                ? t("role.toUnlimited")
                : t("role.toItems", { count: draft.proposalBatchLimit })}
            </p>
          )}
          {dailyLimitChanged && (
            <p className="text-sm">
              {t("role.dailyLimitChanges", { count: holders.length })}
              {draft.proposalDailyLimit === null
                ? t("role.toUnlimited")
                : t("role.toItems", { count: draft.proposalDailyLimit })}
            </p>
          )}
        </>
      ),
    };
  };

  return (
    <SetEditorDialog<RoleDraft>
      isOpen={isOpen}
      onClose={onClose}
      title={
        role === null
          ? t("role.new")
          : isCopy
            ? t("role.duplicate", { name: role.name })
            : t("role.edit", { name: role.name })
      }
      description={t("role.description")}
      width="wide"
      entries={[stored]}
      renderEntries={([draft], onChange) =>
        draft === undefined ? null : (
          <RoleFields
            id={id}
            draft={draft}
            language={language}
            properties={index.properties}
            onChange={(next) => onChange([next])}
          />
        )
      }
      summaryOf={([draft]) =>
        draft === undefined ? null : (
          <p className="text-xs text-muted-foreground">
            {t("role.grantCount", { count: draft.grants.length })}.{" "}
            {isNew && t("role.notHeldDescription")}
          </p>
        )
      }
      invalidReasonOf={invalidReasonOf}
      reachOf={reachOf}
      submitLabel={isNew ? t("role.create") : t("role.save")}
      onSave={async ([draft]) => {
        if (draft === undefined) {
          throw new Error(t("role.oneDraftError"));
        }

        const result = await save.run(draft);
        if (result.isDone) {
          const holderCount = holdersOf(index.users, result.value.id).length;
          onSaved(
            isNew
              ? {
                  title: t("role.created", { name: result.value.name }),
                  text: t("role.createdDescription"),
                }
              : {
                  title: t("role.saved", { name: result.value.name }),
                  text:
                    holderCount === 0
                      ? t("role.nobodyHoldsIt")
                      : t("role.holdersAffected", { count: holderCount }),
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
  language,
  properties,
  onChange,
}: {
  id: string;
  draft: RoleDraft;
  language: "cs" | "en";
  // Each brings its own permission, under Properties (PERM-property-edit).
  properties: AccessIndex["properties"];
  onChange: (next: RoleDraft) => void;
}) {
  // The permission lines are messages: say them again when the language changes.
  useTranslation();
  const nameOfPermission = new Map<Permission, string>(
    properties.map((property) => [editPermissionOf(property.key), property.name]),
  );
  const catalog: Permission[] = [
    ...permissionKeys,
    ...properties.map((property) => editPermissionOf(property.key)),
  ];
  const scopeOf = (permission: Permission) =>
    draft.grants.find((grant) => grant.permission === permission)?.scope;
  // Ticking a permission ticks what it needs too (PERM-requires); unticking a need is left to
  // the save's check, which names what still needs it.
  const setScope = (permission: Permission, scope: Grant["scope"] | undefined) => {
    const grants = draft.grants.filter((grant) => grant.permission !== permission);
    onChange({
      ...draft,
      grants: (scope === undefined
        ? grants
        : withRequirements([...grants, { permission, scope }])
      ).toSorted((first, second) => byCatalogOrder(first.permission, second.permission)),
    });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>{t("role.name")}</Label>
          <Input
            id={`${id}-name`}
            placeholder={t("role.nameExample")}
            value={draft.names[language] ?? ""}
            onChange={(event) =>
              onChange({
                ...draft,
                names: namesAfterEdit(draft.names, language, event.target.value),
              })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-description`}>{t("role.purpose")}</Label>
          <Input
            id={`${id}-description`}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-batch-limit`}>{t("role.itemsPerSubmission")}</Label>
          <Input
            id={`${id}-batch-limit`}
            type="number"
            min={0}
            step={1}
            disabled={draft.proposalBatchLimit === null}
            value={draft.proposalBatchLimit ?? ""}
            onChange={(event) =>
              onChange({ ...draft, proposalBatchLimit: Number(event.target.value) })
            }
          />
        </div>
        <label htmlFor={`${id}-batch-unlimited`} className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            id={`${id}-batch-unlimited`}
            checked={draft.proposalBatchLimit === null}
            onCheckedChange={(checked) =>
              onChange({ ...draft, proposalBatchLimit: checked === true ? null : 10 })
            }
          />
          {t("role.noSubmissionLimit")}
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-proposal-limit`}>{t("role.proposalsPerDay")}</Label>
          <Input
            id={`${id}-proposal-limit`}
            type="number"
            min={0}
            step={1}
            disabled={draft.proposalDailyLimit === null}
            value={draft.proposalDailyLimit ?? ""}
            onChange={(event) =>
              onChange({ ...draft, proposalDailyLimit: Number(event.target.value) })
            }
          />
        </div>
        <label htmlFor={`${id}-unlimited`} className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            id={`${id}-unlimited`}
            checked={draft.proposalDailyLimit === null}
            onCheckedChange={(checked) =>
              onChange({ ...draft, proposalDailyLimit: checked === true ? null : 300 })
            }
          />
          {t("role.noDailyLimit")}
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("role.dailyLimitHelp")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("role.scopeHelp")}</p>
      <div className="gap-8 md:columns-2">
        {permissionGroups.map((group) => (
          <div key={group} className="mb-3 break-inside-avoid">
            <h4 className="border-b pb-1 text-xs font-semibold">
              {t(`record.permissionGroup.${group}`)}
            </h4>
            {catalog
              .filter((permission) => catalogEntryOf(permission).group === group)
              .map((permission) => (
                <PermissionRow
                  key={permission}
                  id={`${id}-${permission}`}
                  permission={permission}
                  line={permissionLineOf(permission, nameOfPermission.get(permission))}
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
  line,
  scope,
  onChange,
}: {
  id: string;
  permission: Permission;
  line: string;
  // Undefined when not granted.
  scope: Grant["scope"] | undefined;
  onChange: (scope: Grant["scope"] | undefined) => void;
}) {
  const { scopes } = catalogEntryOf(permission);
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5">
      <label htmlFor={id} className="min-w-0 text-xs">
        <span className="block font-mono text-caption">{permission}</span>
        <span className="block text-muted-foreground">{line}</span>
      </label>
      {isSelfScoped(permission) ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs">
          <Checkbox
            id={id}
            checked={scope === null}
            onCheckedChange={(isChecked) => onChange(isChecked === true ? null : undefined)}
          />
          {t("record.scope.own")}
        </span>
      ) : (
        <Select
          value={scope === undefined ? noScope : (scope ?? "own")}
          onValueChange={(value) =>
            onChange(value === noScope ? undefined : grantScopeOf(value as CatalogScope))
          }
        >
          <SelectTrigger id={id} size="sm" className="w-28 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noScope}>—</SelectItem>
            {scopes.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`record.scope.${option}`)}
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
          {t("role.changeCount", { count: change.added.length + change.removed.length })}
        </b>
        {change.added.length > 0 && (
          <>
            {" "}
            · {t("role.addsOrWidens")}{" "}
            <span className="font-mono text-xs">{change.added.map(grantText).join(", ")}</span>
          </>
        )}
        {change.removed.length > 0 && (
          <>
            {" "}
            · {t("role.removes")}{" "}
            <span className="font-mono text-xs">
              {change.removed.map(({ permission }) => permission).join(", ")}
            </span>
          </>
        )}
      </p>
      <p>{t("role.reachesPeople", { count: reached.length })}</p>
      <ul className="grid gap-1.5">
        {reached.map(({ user, ways, gains, loses }) => (
          <li key={user.id} className="border-b pb-1.5 text-xs last:border-b-0">
            <span className="font-medium">{user.name}</span>{" "}
            <span className="text-muted-foreground">({waysShortText(ways)})</span>
            <span className="block text-muted-foreground">
              {gains.length + loses.length === 0
                ? t("role.nothingChanges")
                : [
                    gains.length > 0
                      ? t("role.gains", {
                          permissions: gains
                            .map(
                              (held) =>
                                `${held.permission} (${t(`record.scope.${held.scope ?? "own"}`)})`,
                            )
                            .join(", "),
                        })
                      : null,
                    loses.length > 0
                      ? t("role.loses", {
                          permissions: loses.map((held) => held.permission).join(", "),
                        })
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
            ? { text: t("role.nobodyHoldsIt") }
            : {
                text: t("role.deleteHoldersImpact", { count: impact.holders.length }),
              },
          ...impact.holders.map(
            ({ userId, keptRoleIds }): Consequence =>
              keptRoleIds.length === 0
                ? {
                    text: t("role.deleteNoRole", { name: names.user(userId) }),
                    tone: "amber",
                  }
                : {
                    text: t("role.deleteKeepsRoles", {
                      name: names.user(userId),
                      roles: keptRoleIds.map(names.role).join(", "),
                    }),
                  },
          ),
          ...impact.mappings.map(
            ({ instanceId, claim }): Consequence => ({
              text: t("role.deleteMappingImpact", {
                instance: names.instance(instanceId),
                claim: claim ?? t("record.defaultRoleEveryone"),
              }),
            }),
          ),
          ...(impact.leavesNoManager
            ? [{ text: t("role.refusal.lastManager"), tone: "red" as const }]
            : []),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("role.deleteTitle", { name: role.name })}
      description={t("role.deleteDescription", { name: role.name })}
      consequences={consequences}
      confirmLabel={t("role.delete")}
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(role.id);
        if (result.isDone) {
          onDeleted({
            title: t("role.deleted", { name: role.name }),
            text:
              impact === undefined || impact.holders.length === 0
                ? t("role.nobodyHeldIt")
                : t("role.affectedPeople", { count: impact.holders.length }),
          });
        }

        return result;
      }}
    />
  );
}
