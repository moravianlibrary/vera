// What Users & Groups changes, besides a role (view-catalog.md *Users & Groups*; docs/demos/
// shared/page-access.js `userRoles`, `userGroups`, `linkIdentity`, `newLocal`, `editGroup`,
// `groupMembers`, `editCust`, `custMembersModal`, `delCust`; component-interfaces.md §6.6). A
// person's roles by hand, mapped ones said beside and left to the provider; their groups, each
// with what it gives; another identity for the same person; a local account for somebody with no
// institutional one. A group's name and members, with what each member added gets, never a
// role; a custody's name, its groups and people with what each could do with its proposals, and
// its delete, as the server counts it. Each says where it is done and what follows.

import type { AccessIndex, CustodyDraft, LocalAccount, RecordDraft } from "@vera/contract/access";
import { identityLinkSchema, localAccountSchema, recordDraftSchema } from "@vera/contract/access";
import type { AccessGroup, AccessUser, CustodyRecord, Role } from "@vera/domain/access";
import { heldRoleIdsOf, requestReachOf } from "@vera/domain/access";
import { namesToSave } from "@vera/domain/names";
import { useId } from "react";
import { z } from "zod";
import {
  createCustody,
  createGroup,
  createLocalAccount,
  deleteCustody,
  linkIdentity,
  saveCustody,
  saveGroup,
  setCustodyMembers,
  setGroupMembers,
  setHandRoles,
  setIdentityDefaultRole,
  setUserGroups,
  suspendUser,
} from "@/api/access";
import { Field } from "@/components/classification-fields";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { PickerDialog } from "@/components/dialogs/picker-dialog";
import { NamesField } from "@/components/fields/names-field";
import { FieldError } from "@/components/iteration-dialogs";
import { AgentBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessNames } from "@/features/access/access-records";
import { confersText } from "@/features/access/access-words";
import { accessInvalidations, useCustodyImpactQuery } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { i18n } from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "access", ...options });

// Said above the columns once something is saved.
export interface AccessNotice {
  title: string;
  text: string;
  // Green unless an act that opens no dialog was refused.
  isRefusal?: boolean;
}

const refusalTexts = {
  "access.last_manager": t("dialog.refusal.lastManager"),
  "access.name_taken": t("dialog.refusal.nameTaken"),
  "access.identity_taken": t("dialog.refusal.identityTaken"),
  "access.fallback": t("dialog.refusal.fallback"),
  "access.suspended": t("dialog.refusal.suspended"),
  "access.not_suspended": t("dialog.refusal.notSuspended"),
  "access.last_identity": t("dialog.refusal.lastIdentity"),
  403: t("dialog.refusal.forbidden"),
};

// The page's acts that open no dialog word their refusals the same way.
export const accessRefusalTexts = refusalTexts;

const noRoleText = t("record.groupRolesDescription");

const custodyEditorSchema = z.object({
  names: z
    .object({ cs: z.string().optional(), en: z.string().optional() })
    .refine((names) => Object.values(names).some((name) => (name ?? "").trim() !== ""), {
      message: t("watchlist.nameRequired"),
      path: ["cs"],
    }),
  description: z.string().trim(),
});

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  index: AccessIndex;
  names: AccessNames;
}

const defaultRoleDraftSchema = z.object({ roleId: z.string() });

export function IdentityDefaultRoleDialog({
  isOpen,
  onClose,
  index,
  instance,
  onSaved,
}: DialogProps & {
  instance: import("@vera/domain/access").IdentityInstance;
  onSaved: (notice: AccessNotice) => void;
}) {
  const save = useActionMutation({
    call: setIdentityDefaultRole,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.defaultRoleTitle", { name: instance.name })}
      description={t("dialog.defaultRoleDescription")}
      schema={defaultRoleDraftSchema}
      defaultValues={{ roleId: instance.defaultRoleId ?? "none" }}
      submitLabel={t("dialog.save")}
      onSubmit={async ({ roleId }) => {
        const result = await save.run({
          instanceId: instance.id,
          roleId: roleId === "none" ? null : roleId,
        });
        if (result.isDone)
          onSaved({
            title: t("dialog.defaultRoleSaved"),
            text: t("dialog.defaultRoleSavedDescription", {
              instance: instance.name,
              role:
                roleId === "none"
                  ? t("dialog.noRole")
                  : (index.roles.find((role) => role.id === roleId)?.name ?? roleId),
            }),
          });
        return result;
      }}
      render={(form) => (
        <>
          <p>{t("dialog.defaultRoleApplies")}</p>
          <Select
            value={form.watch("roleId")}
            onValueChange={(roleId) => form.setValue("roleId", roleId, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("dialog.noneNoAccess")}</SelectItem>
              {index.roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    />
  );
}

// What being in the group gives, in words.
export function groupConfersText(group: AccessGroup, index: AccessIndex, names: AccessNames) {
  return confersText({
    categoryNames: group.categoryIds.map(names.category),
    custodyNames: index.custodies
      .filter((custody) => custody.groupIds.includes(group.id))
      .map(({ name }) => name),
    projectNames: index.projects
      .filter((project) => project.memberGroupIds.includes(group.id))
      .map(({ name }) => name),
  });
}

function RoleOption({ role }: { role: Role }) {
  return (
    <span className="text-sm">
      <b className="font-medium">{role.name}</b>{" "}
      <span className="text-muted-foreground">
        —{" "}
        {role.description === ""
          ? t("dialog.grantCount", { count: role.grants.length })
          : role.description}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- a person

export function UserRolesDialog({
  isOpen,
  onClose,
  index,
  names,
  user,
  onSaved,
}: DialogProps & { user: AccessUser; onSaved: (notice: AccessNotice) => void }) {
  const save = useActionMutation({
    call: setHandRoles,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  const mappedOf = (role: Role) => {
    const ways = user.mappedRoles.filter((mapped) => mapped.roleId === role.id);
    return ways.length === 0
      ? null
      : t("dialog.alsoMapped", {
          mappings: ways
            .map(
              (way) =>
                `${names.instance(way.instanceId)} ${t("record.fromClaim", { claim: way.claim })}`,
            )
            .join(` ${t("record.and")} `),
        });
  };

  return (
    <PickerDialog<Role>
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.rolesTitle", { name: user.name })}
      description={t("dialog.rolesDescription", { name: user.name })}
      sections={[{ items: index.roles }]}
      itemId={(role) => role.id}
      itemText={(role) => role.name}
      renderItem={(role) => <RoleOption role={role} />}
      heldOtherwiseOf={mappedOf}
      initiallyPicked={new Set(user.handRoleIds)}
      consequenceOf={(picked) => {
        const isLeftWithNone = picked.size === 0 && user.mappedRoles.length === 0;
        return (
          <p className="text-xs text-muted-foreground">
            {t("dialog.rolesByHandHelp")}
            {isLeftWithNone && (
              <span className="mt-1 block text-tone-amber-foreground">
                {t("dialog.noRoleSeeNothing")}
              </span>
            )}
          </p>
        );
      }}
      submitLabel={t("dialog.saveRoles")}
      onSave={async (picked) => {
        const result = await save.run({ recordId: user.id, body: { roleIds: [...picked] } });
        if (result.isDone) {
          const held = heldRoleIdsOf(result.value);
          onSaved({
            title: t("dialog.rolesSavedFor", { name: user.name }),
            text:
              held.length === 0
                ? t("dialog.noRoleSeeNothing")
                : t("dialog.nowRoles", { roles: held.map(names.role).join(", ") }),
          });
        }

        return result;
      }}
    />
  );
}

export function UserGroupsDialog({
  isOpen,
  onClose,
  index,
  names,
  user,
  onSaved,
}: DialogProps & { user: AccessUser; onSaved: (notice: AccessNotice) => void }) {
  const save = useActionMutation({
    call: setUserGroups,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <PickerDialog<AccessGroup>
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.groupsTitle", { name: user.name })}
      description={t("dialog.groupsDescription", { name: user.name })}
      sections={[{ items: index.groups }]}
      itemId={(group) => group.id}
      itemText={(group) => group.name}
      renderItem={(group) => (
        <span className="text-sm">
          <b className="font-medium">{group.name}</b>{" "}
          <span className="text-muted-foreground">
            — {t("dialog.givesText")} {groupConfersText(group, index, names)}
          </span>
        </span>
      )}
      initiallyPicked={new Set(user.groupIds)}
      consequenceOf={() => <p className="text-xs text-muted-foreground">{noRoleText}</p>}
      submitLabel={t("dialog.saveGroups")}
      onSave={async (picked) => {
        const result = await save.run({ recordId: user.id, body: { groupIds: [...picked] } });
        if (result.isDone) {
          onSaved({
            title: t("dialog.groupsSavedFor", { name: user.name }),
            text:
              result.value.groupIds.length === 0
                ? t("dialog.noGroupNow")
                : result.value.groupIds.map(names.group).join(", "),
          });
        }

        return result;
      }}
    />
  );
}

export function LinkIdentityDialog({
  isOpen,
  onClose,
  index,
  names,
  user,
  onSaved,
}: DialogProps & { user: AccessUser; onSaved: (notice: AccessNotice) => void }) {
  const id = useId();
  const link = useActionMutation({
    call: linkIdentity,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.linkIdentityTitle", { name: user.name })}
      description={t("dialog.linkIdentityDescription", { name: user.name })}
      schema={identityLinkSchema}
      defaultValues={{ instanceId: index.identityInstances[0]?.id ?? "", externalId: "" }}
      submitLabel={t("dialog.link")}
      fieldOf={(refusal) => (refusal.status === 409 ? "externalId" : null)}
      onSubmit={async (values) => {
        const result = await link.run({ userId: user.id, link: values });
        if (result.isDone) {
          onSaved({
            title: t("dialog.identityLinked"),
            text: t("dialog.identityLinkedDescription", {
              name: user.name,
              provider: names.instance(values.instanceId),
            }),
          });
        }

        return result;
      }}
      render={(form) => {
        const values = form.watch();
        const errors = form.formState.errors;
        return (
          <>
            <p className="text-muted-foreground">{t("dialog.identityDescription")}</p>
            <Field id={`${id}-instance`} label={t("dialog.provider")}>
              <Select
                value={values.instanceId}
                onValueChange={(value) =>
                  form.setValue("instanceId", value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger id={`${id}-instance`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {index.identityInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {t("dialog.providerClaim", {
                        name: instance.name,
                        claim: instance.userIdClaim,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id={`${id}-external`} label={t("dialog.externalId")}>
              <Input
                id={`${id}-external`}
                placeholder={t("dialog.claimValue")}
                {...form.register("externalId")}
              />
            </Field>
            <FieldError message={errors.externalId?.message} />
          </>
        );
      }}
    />
  );
}

// ACCESS-suspend: nothing is taken away, so restoring gives everything back.
export function SuspendUserDialog({
  isOpen,
  onClose,
  user,
  onSaved,
}: DialogProps & { user: AccessUser; onSaved: (notice: AccessNotice) => void }) {
  const suspend = useActionMutation({
    call: suspendUser,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  const roleCount = heldRoleIdsOf(user).length;
  const consequences: Consequence[] = [
    { text: t("dialog.suspendCannotLogin", { name: user.name }), tone: "red" },
    ...(roleCount === 0 ? [] : [{ text: t("dialog.suspendRolesKept", { count: roleCount }) }]),
    { text: t("dialog.suspendGroupsStay") },
  ];
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.suspendTitle", { name: user.name })}
      description={t("dialog.suspendDescription", { name: user.name })}
      consequences={consequences}
      confirmLabel={t("dialog.suspend")}
      isDestructive
      onConfirm={async () => {
        const result = await suspend.run(user.id);
        if (result.isDone) {
          onSaved({
            title: t("dialog.suspended", { name: user.name }),
            text: t("dialog.suspendCannotLoginGeneric"),
          });
        }

        return result;
      }}
    />
  );
}

export function NewLocalAccountDialog({
  isOpen,
  onClose,
  index,
  names,
  onCreated,
}: DialogProps & { onCreated: (notice: AccessNotice, userId: string) => void }) {
  const id = useId();
  const create = useActionMutation({
    call: createLocalAccount,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  const local = index.identityInstances.find((instance) => instance.isLocal);
  const defaultRoleIds = index.roles.some((role) => role.id === "reader") ? ["reader"] : [];
  return (
    <FormDialog<LocalAccount>
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.newLocalAccount")}
      description={t("dialog.newLocalAccountDescription")}
      schema={localAccountSchema}
      defaultValues={{ name: "", username: "", email: "", roleIds: defaultRoleIds }}
      submitLabel={t("dialog.createAccount")}
      fieldOf={(refusal) => (refusal.code === "access.identity_taken" ? "username" : null)}
      onSubmit={async (values) => {
        const result = await create.run(values);
        if (result.isDone) {
          const held = heldRoleIdsOf(result.value);
          onCreated(
            {
              title: `${result.value.name} created`,
              text:
                held.length === 0
                  ? t("dialog.noRoleUntilGiven")
                  : t("dialog.holdsRolesSetPassword", { roles: held.map(names.role).join(", ") }),
            },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => {
        const errors = form.formState.errors;
        const roleIds = form.watch("roleIds");
        return (
          <>
            <p className="text-muted-foreground">{t("dialog.localAccountHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-3">
                <Field id={`${id}-name`} label={t("dialog.name")}>
                  <Input id={`${id}-name`} {...form.register("name")} />
                </Field>
                <FieldError message={errors.name?.message} />
              </div>
              <div className="grid gap-3">
                <Field id={`${id}-username`} label={t("dialog.username")}>
                  <Input id={`${id}-username`} {...form.register("username")} />
                </Field>
                <FieldError message={errors.username?.message} />
              </div>
            </div>
            <Field id={`${id}-email`} label={t("dialog.email")}>
              <Input
                id={`${id}-email`}
                placeholder={t("dialog.emailExample")}
                {...form.register("email")}
              />
            </Field>
            <fieldset className="grid">
              <legend className="mb-1 text-sm font-medium">
                {t("dialog.roles")}{" "}
                <span className="font-normal text-muted-foreground">
                  — {t("dialog.byHand")}; {local?.name ?? t("dialog.localAccounts")}{" "}
                  {t("dialog.gives")}{" "}
                  {local?.defaultRoleId == null
                    ? t("dialog.noRole")
                    : names.role(local.defaultRoleId)}{" "}
                  {t("dialog.byDefault")}
                </span>
              </legend>
              {index.roles.map((role) => (
                <label
                  key={role.id}
                  htmlFor={`${id}-role-${role.id}`}
                  className="flex items-start gap-2.5 border-b py-1.5 last:border-b-0"
                >
                  <Checkbox
                    id={`${id}-role-${role.id}`}
                    className="mt-0.5"
                    checked={roleIds.includes(role.id)}
                    onCheckedChange={(isChecked) =>
                      form.setValue(
                        "roleIds",
                        isChecked === true
                          ? [...roleIds, role.id]
                          : roleIds.filter((roleId) => roleId !== role.id),
                        { shouldDirty: true },
                      )
                    }
                  />
                  <RoleOption role={role} />
                </label>
              ))}
            </fieldset>
          </>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------- a group

export function GroupEditorDialog({
  isOpen,
  onClose,
  group,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  // Null for a new one.
  group: AccessGroup | null;
  onSaved: (notice: AccessNotice, groupId: string) => void;
}) {
  const id = useId();
  const save = useActionMutation({
    call: (draft: RecordDraft) =>
      group === null ? createGroup(draft) : saveGroup({ groupId: group.id, draft }),
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <FormDialog<RecordDraft>
      isOpen={isOpen}
      onClose={onClose}
      title={group === null ? t("dialog.newGroup") : t("dialog.editGroup", { name: group.name })}
      description={t("dialog.groupDescription")}
      schema={recordDraftSchema}
      defaultValues={{ name: group?.name ?? "", description: group?.description ?? "" }}
      submitLabel={group === null ? t("dialog.createGroup") : t("dialog.saveGroup")}
      fieldOf={(refusal) => (refusal.code === "access.name_taken" ? "name" : null)}
      onSubmit={async (draft) => {
        const result = await save.run(draft);
        if (result.isDone) {
          onSaved(
            group === null
              ? {
                  title: t("dialog.groupCreated", { name: result.value.name }),
                  text: t("dialog.addMembersNext"),
                }
              : { title: t("dialog.groupSaved", { name: result.value.name }), text: "" },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label={t("dialog.name")}>
            <Input
              id={`${id}-name`}
              placeholder={t("dialog.groupNameExample")}
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field id={`${id}-description`} label={t("dialog.groupPurpose")}>
            <Input id={`${id}-description`} {...form.register("description")} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {noRoleText} {t("dialog.groupAfterCreation")}
          </p>
        </>
      )}
    />
  );
}

export function GroupMembersDialog({
  isOpen,
  onClose,
  index,
  names,
  group,
  onSaved,
}: DialogProps & { group: AccessGroup; onSaved: (notice: AccessNotice) => void }) {
  const save = useActionMutation({
    call: setGroupMembers,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <PickerDialog<AccessUser>
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.groupMembersTitle", { name: group.name })}
      description={t("dialog.groupMembersDescription", { name: group.name })}
      sections={[{ items: index.users }]}
      itemId={(user) => user.id}
      itemText={(user) => user.name}
      renderItem={(user) => <PersonOption user={user} names={names} />}
      initiallyPicked={new Set(group.memberIds)}
      consequenceOf={() => (
        <StatusNote tone="blue" title={t("dialog.eachPersonGets")}>
          {groupConfersText(group, index, names)}.
        </StatusNote>
      )}
      submitLabel={t("dialog.saveMembers")}
      onSave={async (picked) => {
        const result = await save.run({ recordId: group.id, body: { userIds: [...picked] } });
        if (result.isDone) {
          onSaved({
            title: t("dialog.membersSaved"),
            text: t("dialog.membersInGroup", {
              count: result.value.memberIds.length,
              name: group.name,
            }),
          });
        }

        return result;
      }}
    />
  );
}

function PersonOption({ user, names }: { user: AccessUser; names: AccessNames }) {
  const roleIds = heldRoleIdsOf(user);
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm">
      <b className="font-medium">{user.name}</b>
      {user.kind === "agent" && <AgentBadge />}
      <span className="text-muted-foreground">
        — {roleIds.length === 0 ? t("record.noRole") : roleIds.map(names.role).join(", ")}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- a request custody

export function CustodyEditorDialog({
  isOpen,
  onClose,
  custody,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  // Null for a new one.
  custody: CustodyRecord | null;
  onSaved: (notice: AccessNotice, custodyId: string) => void;
}) {
  const id = useId();
  const language = i18n.language.startsWith("cs") ? "cs" : "en";
  const save = useActionMutation({
    call: (draft: CustodyDraft) =>
      custody === null ? createCustody(draft) : saveCustody({ custodyId: custody.id, draft }),
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <FormDialog<CustodyDraft>
      isOpen={isOpen}
      onClose={onClose}
      title={
        custody === null
          ? t("dialog.newRequestCustody")
          : t("dialog.editCustody", { name: custody.name })
      }
      description={t("dialog.custodyDescription")}
      schema={custodyEditorSchema}
      defaultValues={{
        names: custody?.names ?? { [language]: "" },
        description: custody?.description ?? "",
      }}
      submitLabel={custody === null ? t("dialog.createCustody") : t("dialog.save")}
      fieldOf={(refusal) =>
        refusal.code === "access.name_taken" || refusal.code === "access.fallback"
          ? `names.${language}`
          : null
      }
      onSubmit={async (draft) => {
        const result = await save.run({ ...draft, names: namesToSave(draft.names) });
        if (result.isDone) {
          onSaved(
            custody === null
              ? {
                  title: t("dialog.custodyCreated", { name: result.value.name }),
                  text: t("dialog.custodyCreatedDescription"),
                }
              : { title: t("dialog.custodySaved", { name: result.value.name }), text: "" },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => (
        <>
          <NamesField
            id={`${id}-name`}
            label={t("dialog.name")}
            placeholder={t("dialog.custodyNameExample")}
            disabled={custody?.isFallback === true}
            names={form.watch("names")}
            onChange={(names) => form.setValue("names", names, { shouldDirty: true })}
          />
          <FieldError
            message={
              form.formState.errors.names?.cs?.message ?? form.formState.errors.names?.en?.message
            }
          />
          <Field id={`${id}-description`} label={t("dialog.custodyCoverage")}>
            <Input id={`${id}-description`} {...form.register("description")} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {custody === null
              ? t("dialog.custodyRuleNeeded")
              : custody.isFallback
                ? t("dialog.fallbackKeepsName")
                : t("dialog.renameCustodyDescription")}
          </p>
        </>
      )}
    />
  );
}

// A custody's members are groups and people; their ids are kept apart by kind.
type CustodyMember = { kind: "group"; group: AccessGroup } | { kind: "user"; user: AccessUser };

const memberIdOf = (member: CustodyMember) =>
  member.kind === "group" ? `group:${member.group.id}` : `user:${member.user.id}`;

export function CustodyMembersDialog({
  isOpen,
  onClose,
  index,
  custody,
  onSaved,
}: DialogProps & { custody: CustodyRecord; onSaved: (notice: AccessNotice) => void }) {
  const save = useActionMutation({
    call: setCustodyMembers,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  const groups = index.groups.map((group): CustodyMember => ({ kind: "group", group }));
  // People only: an agent never decides.
  const people = index.users
    .filter((user) => user.kind === "person")
    .map((user): CustodyMember => ({ kind: "user", user }));

  return (
    <PickerDialog<CustodyMember>
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.custodyMembersTitle", { name: custody.name })}
      description={t("dialog.custodyMembersDescription", { name: custody.name })}
      sections={[
        { title: t("record.groups"), items: groups },
        { title: t("dialog.people"), items: people },
      ]}
      itemId={memberIdOf}
      itemText={(member) => (member.kind === "group" ? member.group.name : member.user.name)}
      renderItem={(member) => {
        if (member.kind === "group") {
          return (
            <span className="text-sm">
              <b className="font-medium">{member.group.name}</b>{" "}
              <span className="text-muted-foreground">
                — {t("record.memberCount", { count: member.group.memberIds.length })}
              </span>
            </span>
          );
        }

        const reach = requestReachOf(index.roles, heldRoleIdsOf(member.user));
        return (
          <span className="text-sm">
            <b className="font-medium">{member.user.name}</b>{" "}
            <span
              className={reach === null ? "text-tone-amber-foreground" : "text-muted-foreground"}
            >
              — {reach === null ? t("dialog.noRoleReachesProposals") : t(`dialog.reach.${reach}`)}
            </span>
          </span>
        );
      }}
      initiallyPicked={
        new Set([
          ...custody.groupIds.map((groupId) => `group:${groupId}`),
          ...custody.memberIds.map((userId) => `user:${userId}`),
        ])
      }
      submitLabel={t("dialog.saveMembers")}
      onSave={async (picked) => {
        const idsOf = (prefix: string) =>
          [...picked].filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length));
        const result = await save.run({
          recordId: custody.id,
          body: { userIds: idsOf("user:"), groupIds: idsOf("group:") },
        });
        if (result.isDone) {
          onSaved({
            title: t("dialog.membersSaved"),
            text: t("dialog.membersInCustody", {
              people: result.value.memberIds.length,
              groups: result.value.groupIds.length,
              name: custody.name,
            }),
          });
        }

        return result;
      }}
    />
  );
}

export function DeleteCustodyDialog({
  isOpen,
  onClose,
  names,
  custody,
  onDeleted,
}: Omit<DialogProps, "index"> & {
  custody: CustodyRecord;
  onDeleted: (notice: AccessNotice) => void;
}) {
  const { data: impact } = useCustodyImpactQuery(custody.id, isOpen);
  const remove = useActionMutation({
    call: deleteCustody,
    invalidates: accessInvalidations,
    refusalTexts,
  });
  const consequences: Consequence[] | undefined =
    impact === undefined
      ? undefined
      : [
          {
            text: t("dialog.deleteCustodyImpact", { count: impact.openCount }),
          },
          ...(impact.toFallbackCount > 0
            ? [
                {
                  text:
                    impact.toFallbackCount === 1
                      ? t("dialog.deleteCustodyFallbackOne")
                      : t("dialog.deleteCustodyFallbackMany", { count: impact.toFallbackCount }),
                  tone: "amber" as const,
                },
              ]
            : []),
          ...impact.ruleIds.map(
            (ruleId): Consequence => ({
              text: t("dialog.deleteCustodyRuleImpact", {
                instance: names.instance(ruleId),
                name: custody.name,
              }),
            }),
          ),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.deleteCustodyTitle", { name: custody.name })}
      description={t("dialog.deleteCustodyDescription", { name: custody.name })}
      consequences={consequences}
      confirmLabel={t("dialog.deleteCustody")}
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(custody.id);
        if (result.isDone) {
          onDeleted({
            title: t("dialog.custodyDeleted", { name: custody.name }),
            text: t("dialog.custodyDeletedDescription"),
          });
        }

        return result;
      }}
    />
  );
}
