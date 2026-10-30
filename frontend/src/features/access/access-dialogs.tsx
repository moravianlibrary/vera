// What Users & Groups changes, besides a role (view-catalog.md *Users & Groups*; docs/demos/
// shared/page-access.js `userRoles`, `userGroups`, `linkIdentity`, `newLocal`, `editGroup`,
// `groupMembers`, `editCust`, `custMembersModal`, `delCust`; component-interfaces.md §6.6). A
// person's roles by hand, mapped ones said beside and left to the provider; their groups, each
// with what it gives; another identity for the same person; a local account for somebody with no
// institutional one. A group's name and members, with what each member added gets, never a
// role; a custody's name, its groups and people with what each could do with its proposals, and
// its delete, as the server counts it. Each says where it is done and what follows.
// TODO(rrandiak): labels move to i18n.

import type { AccessIndex, LocalAccount, RecordDraft } from "@vera/contract/access";
import { identityLinkSchema, localAccountSchema, recordDraftSchema } from "@vera/contract/access";
import type { AccessGroup, AccessUser, CustodyRecord, Role } from "@vera/domain/access";
import { heldRoleIdsOf, requestReachOf } from "@vera/domain/access";
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
import { FieldError } from "@/components/iteration-dialogs";
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
import { AgentBadge } from "@/features/access/access-records";
import { confersText } from "@/features/access/access-words";
import { accessInvalidations, useCustodyImpactQuery } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { plural } from "@/lib/plural";

// Said above the columns once something is saved.
export interface AccessNotice {
  title: string;
  text: string;
  // Green unless an act that opens no dialog was refused.
  isRefusal?: boolean;
}

const refusalTexts = {
  "access.last_manager": "Nobody could manage access after this.",
  "access.name_taken": "There is already one with that name.",
  "access.identity_taken": "Somebody already signs in with that.",
  "access.fallback": "The fallback keeps its name, and cannot be deleted.",
  "access.suspended": "They are suspended already.",
  "access.not_suspended": "They are not suspended.",
  "access.last_identity": "It is their only way in. Suspend them instead.",
  403: "You may no longer change users, groups or roles.",
};

// The page's acts that open no dialog word their refusals the same way.
export const accessRefusalTexts = refusalTexts;

const noRoleText =
  "A group never gives a role. Roles are set by hand here, or mapped by an Identity plugin from a claim.";

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
      title={`Default role: ${instance.name}`}
      description="Choose the role a first login receives."
      schema={defaultRoleDraftSchema}
      defaultValues={{ roleId: instance.defaultRoleId ?? "none" }}
      submitLabel="Save"
      onSubmit={async ({ roleId }) => {
        const result = await save.run({
          instanceId: instance.id,
          roleId: roleId === "none" ? null : roleId,
        });
        if (result.isDone)
          onSaved({
            title: "Default role saved",
            text: `${instance.name} will give ${roleId === "none" ? "no role" : (index.roles.find((role) => role.id === roleId)?.name ?? roleId)} to first logins from now on.`,
          });
        return result;
      }}
      render={(form) => (
        <>
          <p>Applies to first logins from now on; people already in keep their roles.</p>
          <Select
            value={form.watch("roleId")}
            onValueChange={(roleId) => form.setValue("roleId", roleId, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — no access yet</SelectItem>
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
        — {role.description === "" ? plural(role.grants.length, "grant") : role.description}
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
      : `Also mapped by ${ways.map((way) => `${names.instance(way.instanceId)} from ${way.claim}`).join(" and ")}: it follows the provider at every login.`;
  };

  return (
    <PickerDialog<Role>
      isOpen={isOpen}
      onClose={onClose}
      title={`Roles: ${user.name}`}
      description={`The roles ${user.name} holds by hand`}
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
            Roles set by hand. Mapped ones are not changed here.
            {isLeftWithNone && (
              <span className="mt-1 block text-tone-amber-foreground">
                They will hold no role, and see nothing.
              </span>
            )}
          </p>
        );
      }}
      submitLabel="Save roles"
      onSave={async (picked) => {
        const result = await save.run({ recordId: user.id, body: { roleIds: [...picked] } });
        if (result.isDone) {
          const held = heldRoleIdsOf(result.value);
          onSaved({
            title: `Roles saved for ${user.name}`,
            text:
              held.length === 0
                ? "They hold no role now: they will see nothing."
                : `Now ${held.map(names.role).join(", ")}.`,
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
      title={`Groups: ${user.name}`}
      description={`The groups ${user.name} is in`}
      sections={[{ items: index.groups }]}
      itemId={(group) => group.id}
      itemText={(group) => group.name}
      renderItem={(group) => (
        <span className="text-sm">
          <b className="font-medium">{group.name}</b>{" "}
          <span className="text-muted-foreground">
            — gives {groupConfersText(group, index, names)}
          </span>
        </span>
      )}
      initiallyPicked={new Set(user.groupIds)}
      consequenceOf={() => <p className="text-xs text-muted-foreground">{noRoleText}</p>}
      submitLabel="Save groups"
      onSave={async (picked) => {
        const result = await save.run({ recordId: user.id, body: { groupIds: [...picked] } });
        if (result.isDone) {
          onSaved({
            title: `Groups saved for ${user.name}`,
            text:
              result.value.groupIds.length === 0
                ? "In no group now."
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
      title={`Link an identity: ${user.name}`}
      description={`Another way for ${user.name} to log in`}
      schema={identityLinkSchema}
      defaultValues={{ instanceId: index.identityInstances[0]?.id ?? "", externalId: "" }}
      submitLabel="Link"
      fieldOf={(refusal) => (refusal.status === 409 ? "externalId" : null)}
      onSubmit={async (values) => {
        const result = await link.run({ userId: user.id, link: values });
        if (result.isDone) {
          onSaved({
            title: "Identity linked",
            text: `${user.name} can now log in with ${names.instance(values.instanceId)}.`,
          });
        }

        return result;
      }}
      render={(form) => {
        const values = form.watch();
        const errors = form.formState.errors;
        return (
          <>
            <p className="text-muted-foreground">
              Another way for the same person to log in. Their record, roles and history stay one.
            </p>
            <Field id={`${id}-instance`} label="Provider">
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
                      {instance.name} — user id is {instance.userIdClaim}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id={`${id}-external`} label="Their id there">
              <Input
                id={`${id}-external`}
                placeholder="the value of that claim"
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
    { text: `${user.name} cannot log in until restored.`, tone: "red" },
    ...(roleCount === 0
      ? []
      : [{ text: `Their ${plural(roleCount, "role")} are kept, but give nothing meanwhile.` }]),
    { text: "Their groups, history and open asks stay." },
  ];
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Suspend ${user.name}?`}
      description={`What suspending ${user.name} does`}
      consequences={consequences}
      confirmLabel="Suspend"
      isDestructive
      onConfirm={async () => {
        const result = await suspend.run(user.id);
        if (result.isDone) {
          onSaved({
            title: `${user.name} suspended`,
            text: "They cannot log in until restored.",
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
      title="New local account"
      description="A username and password kept by VERA, for somebody with no institutional account"
      schema={localAccountSchema}
      defaultValues={{ name: "", username: "", email: "", roleIds: defaultRoleIds }}
      submitLabel="Create account"
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
                  ? "No role: they will see nothing until given one."
                  : `Holds ${held.map(names.role).join(", ")}. They set a password at first login.`,
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
            <p className="text-muted-foreground">
              For somebody with no institutional account. People with one appear by themselves the
              first time they log in; agents are created with their plugin.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-3">
                <Field id={`${id}-name`} label="Name">
                  <Input id={`${id}-name`} {...form.register("name")} />
                </Field>
                <FieldError message={errors.name?.message} />
              </div>
              <div className="grid gap-3">
                <Field id={`${id}-username`} label="Username">
                  <Input id={`${id}-username`} {...form.register("username")} />
                </Field>
                <FieldError message={errors.username?.message} />
              </div>
            </div>
            <Field id={`${id}-email`} label="Email">
              <Input id={`${id}-email`} placeholder="name@example.cz" {...form.register("email")} />
            </Field>
            <fieldset className="grid">
              <legend className="mb-1 text-sm font-medium">
                Roles{" "}
                <span className="font-normal text-muted-foreground">
                  — by hand; {local?.name ?? "Local accounts"} gives{" "}
                  {local?.defaultRoleId == null ? "no role" : names.role(local.defaultRoleId)} by
                  default
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
      title={group === null ? "New group" : `Edit group ${group.name}`}
      description="A group's name and what it is for"
      schema={recordDraftSchema}
      defaultValues={{ name: group?.name ?? "", description: group?.description ?? "" }}
      submitLabel={group === null ? "Create group" : "Save group"}
      fieldOf={(refusal) => (refusal.code === "access.name_taken" ? "name" : null)}
      onSubmit={async (draft) => {
        const result = await save.run(draft);
        if (result.isDone) {
          onSaved(
            group === null
              ? { title: `Group ${result.value.name} created`, text: "Add members next." }
              : { title: `Group ${result.value.name} saved`, text: "" },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input id={`${id}-name`} placeholder="e.g. Maps Curators" {...form.register("name")} />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field id={`${id}-description`} label="What it is for">
            <Input id={`${id}-description`} {...form.register("description")} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {noRoleText} Once it exists: category custody on Categories, projects on Projects,
            request custody from the custody here.
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
      title={`Members: ${group.name}`}
      description={`Who is in ${group.name}`}
      sections={[{ items: index.users }]}
      itemId={(user) => user.id}
      itemText={(user) => user.name}
      renderItem={(user) => <PersonOption user={user} names={names} />}
      initiallyPicked={new Set(group.memberIds)}
      consequenceOf={() => (
        <StatusNote tone="blue" title="Each person added gets">
          {groupConfersText(group, index, names)}.
        </StatusNote>
      )}
      submitLabel="Save members"
      onSave={async (picked) => {
        const result = await save.run({ recordId: group.id, body: { userIds: [...picked] } });
        if (result.isDone) {
          onSaved({
            title: "Members saved",
            text: `${plural(result.value.memberIds.length, "person", "people")} in ${group.name}.`,
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
        — {roleIds.length === 0 ? "no role" : roleIds.map(names.role).join(", ")}
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
  const save = useActionMutation({
    call: (draft: RecordDraft) =>
      custody === null ? createCustody(draft) : saveCustody({ custodyId: custody.id, draft }),
    invalidates: accessInvalidations,
    refusalTexts,
  });
  return (
    <FormDialog<RecordDraft>
      isOpen={isOpen}
      onClose={onClose}
      title={custody === null ? "New request custody" : `Edit ${custody.name}`}
      description="A request custody's name and what it covers"
      schema={recordDraftSchema}
      defaultValues={{ name: custody?.name ?? "", description: custody?.description ?? "" }}
      submitLabel={custody === null ? "Create custody" : "Save"}
      fieldOf={(refusal) =>
        refusal.code === "access.name_taken" || refusal.code === "access.fallback" ? "name" : null
      }
      onSubmit={async (draft) => {
        const result = await save.run(draft);
        if (result.isDone) {
          onSaved(
            custody === null
              ? {
                  title: `Custody ${result.value.name} created`,
                  text: "Add members, then name it in a Custody rule.",
                }
              : { title: `Custody ${result.value.name} saved`, text: "" },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input
              id={`${id}-name`}
              placeholder="e.g. Maps"
              disabled={custody?.isFallback === true}
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field id={`${id}-description`} label="What it covers">
            <Input id={`${id}-description`} {...form.register("description")} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {custody === null
              ? "It holds nothing until a Custody rule on Plugins returns this name."
              : custody.isFallback
                ? "The fallback keeps its name."
                : "Renaming it: rules that return the old name stop placing proposals here until they are changed."}
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

const reachTexts = { decides: "would decide", sees: "would see only" } as const;

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
      title={`Members: ${custody.name}`}
      description={`The groups and people in ${custody.name}`}
      sections={[
        { title: "Groups", items: groups },
        { title: "People", items: people },
      ]}
      itemId={memberIdOf}
      itemText={(member) => (member.kind === "group" ? member.group.name : member.user.name)}
      renderItem={(member) => {
        if (member.kind === "group") {
          return (
            <span className="text-sm">
              <b className="font-medium">{member.group.name}</b>{" "}
              <span className="text-muted-foreground">
                — {plural(member.group.memberIds.length, "member")}
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
              — {reach === null ? "no role reaches proposals" : reachTexts[reach]}
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
      submitLabel="Save members"
      onSave={async (picked) => {
        const idsOf = (prefix: string) =>
          [...picked].filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length));
        const result = await save.run({
          recordId: custody.id,
          body: { userIds: idsOf("user:"), groupIds: idsOf("group:") },
        });
        if (result.isDone) {
          onSaved({
            title: "Members saved",
            text: `${plural(result.value.memberIds.length, "person", "people")} and ${plural(result.value.groupIds.length, "group")} in ${custody.name}.`,
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
            text: `Every open proposal is placed again, as when a rule changes. The ${plural(impact.openCount, "open proposal")} in it lose this custody.`,
          },
          ...(impact.toFallbackCount > 0
            ? [
                {
                  text:
                    impact.toFallbackCount === 1
                      ? "1 of them is in no other custody and lands in the Fallback."
                      : `${impact.toFallbackCount} of them are in no other custody and land in the Fallback.`,
                  tone: "amber" as const,
                },
              ]
            : []),
          ...impact.ruleIds.map(
            (ruleId): Consequence => ({
              text: `${names.instance(ruleId)} still returns ${custody.name}: it shows a warning on Plugins until it is changed.`,
            }),
          ),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${custody.name}?`}
      description={`What deleting the request custody ${custody.name} does to its proposals`}
      consequences={consequences}
      confirmLabel="Delete custody"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(custody.id);
        if (result.isDone) {
          onDeleted({
            title: `${custody.name} deleted`,
            text: "Its proposals were placed again.",
          });
        }

        return result;
      }}
    />
  );
}
