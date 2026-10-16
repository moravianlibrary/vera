// Access records in Users management's detail pane. Everything comes with
// its provenance (permissions.md §6): a user's roles and how each is held, how they sign in, their
// groups, the custody and projects they hold directly or via which group, and every permission
// with the roles it comes from; a role's holders, the Identity mappings that give it and its
// grants; what joining a group gives, never a role; a custody's members, what each can do with
// its proposals, and the rule that places proposals in it. Category custody is shown here and
// changed on Categories; mappings and Custody rules on Plugins.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { AccessIndex } from "@/api/access";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import type {
  AccessGroup,
  AccessUser,
  CustodyRecord,
  EffectivePermission,
  Identity,
  Role,
  RoleWay,
} from "@/domain/access";
import {
  categoryCustodyOf,
  custodyMembersOf,
  effectivePermissionsOf,
  heldRoleIdsOf,
  heldRolesOf,
  holdersOf,
  includedRolesOf,
  mappingsOf,
  projectsOf,
  requestCustodyOf,
  requestReachOf,
} from "@/domain/access";
import type { GrantScope, Permission } from "@/domain/permissions";
import { byCatalogOrder, catalogEntryOf, permissionGroups } from "@/domain/permissions";
import type { AccessSelection, AccessSelectionKind } from "@/features/access/access-view";
import {
  confersText,
  permissionLineOf,
  scopeLabelOf,
  viaText,
  waysShortText,
} from "@/features/access/access-words";
import { pluginInstanceHrefOf } from "@/features/plugins/plugins-view";
import { formatDay } from "@/lib/format-date";
import { agoText } from "@/lib/format-moment";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

// Names out of the index; the categories' paths and the plugin instances' names from the
// reference data.
export interface AccessNames {
  user: (id: string) => string;
  role: (id: string) => string;
  group: (id: string) => string;
  custody: (id: string) => string;
  instance: (id: string) => string;
  project: (id: string) => string;
  category: (id: string) => string;
}

export function namesOf(
  index: AccessIndex,
  {
    categoryOf,
    instanceOf,
  }: { categoryOf: (id: string) => string; instanceOf: (id: string) => string },
): AccessNames {
  const nameIn =
    (records: readonly { id: string; name: string }[]) =>
    (id: string): string =>
      records.find((record) => record.id === id)?.name ?? id;
  return {
    user: nameIn(index.users),
    role: nameIn(index.roles),
    group: nameIn(index.groups),
    custody: nameIn(index.custodies),
    instance: instanceOf,
    project: nameIn(index.projects),
    category: categoryOf,
  };
}

interface RecordProps {
  index: AccessIndex;
  names: AccessNames;
  onSelect: (selection: AccessSelection) => void;
  // What may be done to it, already narrowed to the caller (9.3).
  actions?: ReactNode;
}

const linkClass = "font-medium underline-offset-2 hover:underline";

// ---------------------------------------------------------------- the frame

function RecordFrame({
  title,
  badge,
  sub,
  actions,
  children,
}: {
  title: string;
  badge?: ReactNode;
  sub: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="@container rounded-lg border bg-card px-5 py-4" aria-label={title}>
      <div className="mb-3 flex flex-col gap-2 @2xl:flex-row @2xl:items-start @2xl:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {title}
            {badge}
          </h2>
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        </div>
        {actions !== undefined && <div className="flex flex-wrap gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Columns({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 @3xl:grid-cols-2">{children}</div>;
}

function Part({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
        {aside !== undefined && (
          <span className="font-normal tracking-normal normal-case"> · {aside}</span>
        )}
      </h3>
      {children}
    </div>
  );
}

function Row({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-1.5 text-[0.8125rem] last:border-b-0">
      <div className="min-w-0">{children}</div>
      {aside !== undefined && <div className="ml-auto min-w-0 text-right">{aside}</div>}
    </div>
  );
}

function None({ text = "None." }: { text?: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

function Fine({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

// Another record on the page, selected by naming it.
function RecordLink({
  kind,
  id,
  onSelect,
  children,
}: {
  kind: AccessSelectionKind;
  id: string;
  onSelect: (selection: AccessSelection) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(linkClass, "text-left")}
      onClick={() => onSelect({ kind, id })}
    >
      {children}
    </button>
  );
}

export function AgentBadge() {
  return (
    <ToneBadge tone="purple" className="px-1.5 py-0 text-[0.625rem]">
      agent
    </ToneBadge>
  );
}

// ACCESS-suspend.
export function SuspendedBadge() {
  return (
    <ToneBadge tone="red" className="px-1.5 py-0 text-[0.625rem]">
      suspended
    </ToneBadge>
  );
}

function HandTag() {
  return (
    <span className="rounded-full bg-tone-purple px-2 py-px text-[0.6875rem] text-tone-purple-foreground">
      by hand
    </span>
  );
}

// How a role reaches the person, each way: "by hand", "mapped by MZK Keycloak from …".
function Ways({ ways, names }: { ways: readonly RoleWay[]; names: AccessNames }) {
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1">
      {ways.map((way, position) => (
        <span key={way.by === "hand" ? "hand" : `${way.instanceId}:${way.claim}`}>
          {position > 0 && <Muted>and </Muted>}
          {way.by === "hand" ? (
            <HandTag />
          ) : (
            <>
              mapped by{" "}
              <Link to={pluginInstanceHrefOf(way.instanceId)} className={linkClass}>
                {names.instance(way.instanceId)}
              </Link>{" "}
              <Muted>from {way.claim}</Muted>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- permissions

const scopeTones = {
  any: "bg-tone-blue text-tone-blue-foreground",
  custody: "bg-tone-green text-tone-green-foreground",
  project: "bg-tone-green text-tone-green-foreground",
  managed: "bg-tone-green text-tone-green-foreground",
} as const;

function ScopePill({ scope }: { scope: GrantScope }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[0.625rem]",
        scope === null ? "bg-muted text-muted-foreground" : scopeTones[scope],
      )}
    >
      {scopeLabelOf(scope)}
    </span>
  );
}

interface PermissionRow {
  permission: Permission;
  scope: GrantScope;
  // Where it comes from, on a person's record.
  from?: ReactNode;
}

// Grouped as the catalogue groups them, in as many columns as the room takes.
function PermissionTable({ rows }: { rows: readonly PermissionRow[] }) {
  // The permission lines are messages: say them again when the language changes.
  useTranslation();
  const sorted = rows.toSorted((first, second) =>
    byCatalogOrder(first.permission, second.permission),
  );
  return (
    <div className="gap-8 @3xl:columns-2 @6xl:columns-3">
      {permissionGroups.map((group) => {
        const inGroup = sorted.filter((row) => catalogEntryOf(row.permission).group === group);
        if (inGroup.length === 0) {
          return null;
        }

        return (
          <div key={group} className="mb-3 break-inside-avoid">
            <h4 className="mb-1 text-xs font-semibold">{group}</h4>
            {inGroup.map((row) => (
              <div
                key={row.permission}
                title={permissionLineOf(row.permission)}
                className="flex flex-wrap items-baseline gap-1.5 border-b py-0.5 text-xs"
              >
                <span className="font-mono text-[0.6875rem]">{row.permission}</span>
                <ScopePill scope={row.scope} />
                {row.from !== undefined && (
                  <span className="ml-auto text-[0.6875rem]">{row.from}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- a user

export function UserRecord({
  index,
  names,
  onSelect,
  actions,
  user,
  onUnlink,
}: RecordProps & {
  user: AccessUser;
  // Given with `access.manage`; offered on each identity but the last (ACCESS-link-identity).
  onUnlink?: (identity: Identity) => void;
}) {
  const held = heldRolesOf(user);
  const permissions = effectivePermissionsOf(index.roles, heldRoleIdsOf(user));
  const custodies = requestCustodyOf(user.id, index.groups, index.custodies);
  const reach = requestReachOf(index.roles, heldRoleIdsOf(user));
  const firstIdentity = user.identities[0];
  const groupLink = (groupId: string) => (
    <RecordLink kind="groups" id={groupId} onSelect={onSelect}>
      {names.group(groupId)}
    </RecordLink>
  );
  const via = (groupId: string | null, direct: string) =>
    groupId === null ? <Muted>{direct}</Muted> : <Muted>via {names.group(groupId)}</Muted>;

  return (
    <RecordFrame
      title={user.name}
      badge={
        user.kind === "agent" ? (
          <AgentBadge />
        ) : user.suspendedAt !== null ? (
          <SuspendedBadge />
        ) : undefined
      }
      sub={
        user.kind === "agent" ? (
          user.entry === null ? (
            <>A plugin acting as a user; what it does is logged as it. It never logs in.</>
          ) : (
            <>
              A plugin acting as a user: it enters through <b>{user.entry}</b>, so what it proposes
              goes through review. It never logs in.
            </>
          )
        ) : (
          user.email
        )
      }
      actions={actions}
    >
      {user.suspendedAt !== null && (
        <StatusNote tone="red" title={`Suspended ${formatDay(user.suspendedAt)}`} className="mb-1">
          They cannot log in. Their roles are kept but give nothing until they are restored; their
          groups, history and open asks stay.
        </StatusNote>
      )}
      {held.length === 0 && (
        <StatusNote tone="amber" title="No access yet" className="mb-1">
          {firstIdentity === undefined
            ? "They hold no role and see nothing."
            : `They logged in through ${names.instance(firstIdentity.instanceId)}, whose default role is none, and see “You have no access yet”.`}{" "}
          Give them a role, reader at least.
        </StatusNote>
      )}
      <Columns>
        <div>
          <Part title="Roles, and how">
            {held.length === 0 && <None />}
            {held.map(({ roleId, ways }) => (
              <Row key={roleId} aside={<Ways ways={ways} names={names} />}>
                <RecordLink kind="roles" id={roleId} onSelect={onSelect}>
                  {names.role(roleId)}
                </RecordLink>
              </Row>
            ))}
            {held.some(({ ways }) => ways.length > 1) && (
              <Fine>
                Held two ways is not a conflict. Remove the hand-set one and the mapped one still
                holds.
              </Fine>
            )}
            {held.some(({ ways }) => ways.some((way) => way.by === "mapped")) && (
              <Fine>
                Mapped roles follow the provider: they are checked again at every login. Change them
                there, or the mapping on Plugins.
              </Fine>
            )}
          </Part>
          <Part title="Signs in with">
            {user.identities.length === 0 && (
              <None
                text={
                  user.kind === "agent"
                    ? "Nothing: an agent has no identity."
                    : "No identity linked."
                }
              />
            )}
            {user.identities.map((identity) => (
              <Row
                key={`${identity.instanceId}:${identity.externalId}`}
                aside={
                  <>
                    <Muted>
                      {identity.lastLoginAt === null
                        ? "never logged in"
                        : `last ${agoText(identity.lastLoginAt, index.asOf)}`}
                    </Muted>
                    {onUnlink !== undefined && user.identities.length > 1 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="ml-2 h-auto p-0 text-xs"
                        onClick={() => onUnlink(identity)}
                      >
                        Unlink
                      </Button>
                    )}
                  </>
                }
              >
                <Link to={pluginInstanceHrefOf(identity.instanceId)} className={linkClass}>
                  {names.instance(identity.instanceId)}
                </Link>{" "}
                <span className="font-mono text-xs">{identity.externalId}</span>
              </Row>
            ))}
          </Part>
          <Part title="Groups">
            {user.groupIds.length === 0 && <None />}
            {user.groupIds.map((groupId) => (
              <Row
                key={groupId}
                aside={
                  <Muted>{index.groups.find((group) => group.id === groupId)?.description}</Muted>
                }
              >
                {groupLink(groupId)}
              </Row>
            ))}
          </Part>
        </div>
        <div>
          <CategoryCustodyPart
            held={categoryCustodyOf(user.id, index.groups, index.categoryMemberships).map(
              ({ categoryId, via }) => ({
                categoryId,
                key: `${categoryId}:${via}`,
                aside: <Muted>{viaText(via, names.group, "direct")}</Muted>,
              }),
            )}
            names={names}
          />
          <Part title="Request custody">
            {custodies.length === 0 && <None />}
            {custodies.map(({ custodyId, via: by }) => (
              <Row key={`${custodyId}:${by}`} aside={via(by, "member")}>
                <RecordLink kind="custodies" id={custodyId} onSelect={onSelect}>
                  {names.custody(custodyId)}
                </RecordLink>
              </Row>
            ))}
            {custodies.length > 0 && reach === null && (
              <Fine>
                A member, but no role of theirs reaches proposals: they see nothing in it.
              </Fine>
            )}
          </Part>
          <Part title="Projects">
            <ProjectRows user={user} index={index} names={names} />
          </Part>
        </div>
      </Columns>
      <Part
        title="What they can do"
        aside={`${plural(permissions.length, "permission")}, and which role each comes from`}
      >
        {permissions.length === 0 ? (
          <None text="Nothing." />
        ) : (
          <PermissionTable
            rows={permissions.map((permission) => ({
              ...permission,
              from: <FromRoles permission={permission} user={user} />,
            }))}
          />
        )}
      </Part>
    </RecordFrame>
  );
}

// "admin by hand, staff mapped".
function FromRoles({ permission, user }: { permission: EffectivePermission; user: AccessUser }) {
  const held = heldRolesOf(user);
  const roleIds = held
    .map(({ roleId }) => roleId)
    .filter((roleId) => permission.roleIds.includes(roleId));
  return (
    <>
      {roleIds.map((roleId, position) => (
        <span key={roleId}>
          {position > 0 && ", "}
          {roleId}{" "}
          <Muted>{waysShortText(held.find((role) => role.roleId === roleId)?.ways ?? [])}</Muted>
        </span>
      ))}
    </>
  );
}

function ProjectRows({
  user,
  index,
  names,
}: {
  user: AccessUser;
  index: AccessIndex;
  names: AccessNames;
}) {
  const projects = projectsOf(user.id, index.groups, index.projects);
  if (projects.length === 0) {
    return <None />;
  }

  return (
    <>
      {projects.map(({ projectId, via }) => (
        <Row
          key={`${projectId}:${typeof via === "string" ? via : via.groupId}`}
          aside={<Muted>{typeof via === "string" ? via : `via ${names.group(via.groupId)}`}</Muted>}
        >
          <Link to={`/projects/${encodeURIComponent(projectId)}`} className={linkClass}>
            {names.project(projectId)}
          </Link>
        </Row>
      ))}
    </>
  );
}

function CategoryCustodyPart({
  held,
  names,
}: {
  // How each is held, on a person's record.
  held: readonly { categoryId: string; key: string; aside?: ReactNode }[];
  names: AccessNames;
}) {
  return (
    <Part title="Category custody">
      {held.length === 0 && <None />}
      {held.map(({ categoryId, key, aside }) => (
        <Row key={key} aside={aside}>
          <Link to={`/categories?c=${encodeURIComponent(categoryId)}`} className={linkClass}>
            {names.category(categoryId)}
          </Link>{" "}
          <Muted>and everything under it</Muted>
        </Row>
      ))}
      <Fine>
        Category custody is granted on{" "}
        <Link to="/categories" className={linkClass}>
          Categories
        </Link>
        , from the branch, not here.
      </Fine>
    </Part>
  );
}

// ---------------------------------------------------------------- a role

export function RoleRecord({
  index,
  names,
  onSelect,
  actions,
  role,
}: RecordProps & { role: Role }) {
  const holders = holdersOf(index.users, role.id);
  const included = includedRolesOf(index.roles, role);
  const mappings = mappingsOf(index.identityInstances, role.id);
  return (
    <RecordFrame
      title={role.name}
      badge={
        <ToneBadge tone={role.isShipped ? "slate" : "blue"} className="px-1.5 py-0 text-[0.625rem]">
          {role.isShipped ? "shipped" : "custom"}
        </ToneBadge>
      }
      sub={
        <>
          {role.description}
          {included.length > 0 && (
            <>
              {role.description !== "" && " · "}
              includes everything{" "}
              {included.map((other, position) => (
                <span key={other.id}>
                  {position > 0 && " and "}
                  <RecordLink kind="roles" id={other.id} onSelect={onSelect}>
                    {other.name}
                  </RecordLink>
                </span>
              ))}{" "}
              has
            </>
          )}
        </>
      }
      actions={actions}
    >
      <Columns>
        <Part title="Held by" aside={String(holders.length)}>
          {holders.length === 0 && <None text="Nobody." />}
          {holders.map(({ user, ways }) => (
            <Row key={user.id} aside={<Ways ways={ways} names={names} />}>
              <RecordLink kind="users" id={user.id} onSelect={onSelect}>
                {user.name}
              </RecordLink>
            </Row>
          ))}
        </Part>
        <Part title="Mapped by identity providers">
          {mappings.length === 0 && <None text="No mapping gives it: only by hand." />}
          {mappings.map(({ instanceId, claim }) => (
            <Row
              key={`${instanceId}:${claim}`}
              aside={<Muted>{claim ?? "default role: everyone first seen here"}</Muted>}
            >
              <Link to={pluginInstanceHrefOf(instanceId)} className={linkClass}>
                {names.instance(instanceId)}
              </Link>
            </Row>
          ))}
          <Fine>
            Mappings are set on the Identity instance, on{" "}
            <Link to="/plugins?kind=Identity" className={linkClass}>
              Plugins
            </Link>
            .
          </Fine>
        </Part>
      </Columns>
      <Part
        title="Proposal submission limit"
        aside={role.proposalBatchLimit === null ? "Unlimited" : `${role.proposalBatchLimit} items`}
      >
        <Fine>Maximum items in one submission for a holder of this role.</Fine>
      </Part>
      <Part
        title="Proposal daily limit"
        aside={role.proposalDailyLimit === null ? "Unlimited" : `${role.proposalDailyLimit} items`}
      >
        <Fine>
          Accepted items per library calendar day. Among roles granting request.create, the highest
          limit applies, or unlimited if one has no limit.
        </Fine>
      </Part>
      <Part
        title="Grants"
        aside={
          <>
            {role.grants.length} · <i>own</i> is self-scoped: it acts on the holder's own records
            and has no scope to choose · <i>managed</i> is a project they manage
          </>
        }
      >
        {role.grants.length === 0 ? (
          <None text="None: whoever holds only this role sees nothing." />
        ) : (
          <PermissionTable rows={role.grants} />
        )}
      </Part>
    </RecordFrame>
  );
}

// ---------------------------------------------------------------- a group

export function GroupRecord({
  index,
  names,
  onSelect,
  actions,
  group,
}: RecordProps & { group: AccessGroup }) {
  const custodies = index.custodies.filter((custody) => custody.groupIds.includes(group.id));
  const projects = index.projects.filter((project) => project.memberGroupIds.includes(group.id));
  const members = index.users.filter((user) => group.memberIds.includes(user.id));
  return (
    <RecordFrame title={group.name} sub={group.description} actions={actions}>
      <StatusNote tone="blue" title="Adding somebody here gives them">
        {confersText({
          categoryNames: group.categoryIds.map(names.category),
          custodyNames: custodies.map(({ name }) => name),
          projectNames: projects.map(({ name }) => name),
        })}
        .
      </StatusNote>
      <Columns>
        <Part title="Members" aside={String(members.length)}>
          {members.length === 0 && <None text="Nobody yet." />}
          {members.map((user) => {
            const roleIds = heldRoleIdsOf(user);
            return (
              <Row
                key={user.id}
                aside={
                  <Muted>
                    {roleIds.length === 0 ? "no role" : roleIds.map(names.role).join(", ")}
                  </Muted>
                }
              >
                <RecordLink kind="users" id={user.id} onSelect={onSelect}>
                  {user.name}
                </RecordLink>{" "}
                {user.kind === "agent" && <AgentBadge />}
              </Row>
            );
          })}
          <Fine>
            A group never gives a role. Roles are set by hand here, or mapped by an Identity plugin
            from a claim.
          </Fine>
        </Part>
        <div>
          <CategoryCustodyPart
            held={group.categoryIds.map((categoryId) => ({ categoryId, key: categoryId }))}
            names={names}
          />
          <Part title="Request custody">
            {custodies.length === 0 && <None />}
            {custodies.map((custody) => (
              <Row key={custody.id} aside={<Muted>{custody.openCount} open</Muted>}>
                <RecordLink kind="custodies" id={custody.id} onSelect={onSelect}>
                  {custody.name}
                </RecordLink>
              </Row>
            ))}
          </Part>
          <Part title="Projects">
            {projects.length === 0 && <None />}
            {projects.map((project) => (
              <Row key={project.id}>
                <Link to={`/projects/${encodeURIComponent(project.id)}`} className={linkClass}>
                  {project.name}
                </Link>
              </Row>
            ))}
          </Part>
        </div>
      </Columns>
    </RecordFrame>
  );
}

// ---------------------------------------------------------------- a request custody

const reachLabels = { decides: "decides", sees: "sees only" } as const;

export function CustodyRecordView({
  index,
  names,
  onSelect,
  actions,
  custody,
}: RecordProps & { custody: CustodyRecord }) {
  const members = custodyMembersOf(custody, index.groups);
  const placedProposals = index.proposals.filter((proposal) =>
    proposal.custodyIds.includes(custody.id),
  );
  return (
    <RecordFrame
      title={custody.name}
      badge={
        custody.isFallback ? (
          <ToneBadge tone="amber" className="px-1.5 py-0 text-[0.625rem]">
            fallback
          </ToneBadge>
        ) : undefined
      }
      sub={
        <>
          {custody.description}
          {custody.description !== "" && " · "}
          <Link to={`/requests?custody=${encodeURIComponent(custody.id)}`} className={linkClass}>
            {plural(custody.openCount, "open proposal")}
          </Link>
        </>
      }
      actions={actions}
    >
      <StatusNote
        tone="blue"
        title={
          custody.isFallback
            ? "What no rule placed lands here"
            : "Which proposals are in it is a rule's answer, never typed in"
        }
      >
        {custody.isFallback ? (
          "Every Custody rule answered nothing for these. It cannot be deleted. With no members, only admins see them."
        ) : custody.placedByIds.length > 0 ? (
          <>
            Placed by{" "}
            {custody.placedByIds.map((instanceId, position) => (
              <span key={instanceId}>
                {position > 0 && ", "}
                <Link to={pluginInstanceHrefOf(instanceId)} className={linkClass}>
                  {names.instance(instanceId)}
                </Link>
              </span>
            ))}
            , on Plugins. To move a proposal, change the rule.
          </>
        ) : (
          "No Custody rule names it yet, so it holds nothing. Add its name to a rule on Plugins."
        )}
      </StatusNote>
      <Columns>
        <Part title="Members" aside={String(members.length)}>
          {members.length === 0 && <None text="Nobody." />}
          {members.map(({ userId, via }) => {
            const user = index.users.find((candidate) => candidate.id === userId);
            const reach =
              user === undefined ? null : requestReachOf(index.roles, heldRoleIdsOf(user));
            return (
              <Row
                key={userId}
                aside={
                  reach === null ? (
                    <span className="text-tone-amber-foreground">no role reaches it</span>
                  ) : (
                    <Muted>{reachLabels[reach]}</Muted>
                  )
                }
              >
                <RecordLink kind="users" id={userId} onSelect={onSelect}>
                  {names.user(userId)}
                </RecordLink>{" "}
                <Muted>{via.map((way) => viaText(way, names.group, "direct")).join(" and ")}</Muted>
              </Row>
            );
          })}
          <Fine>
            Membership is not capability: a member decides only with{" "}
            <span className="font-mono">request.decide</span>, and sees only with{" "}
            <span className="font-mono">request.read</span>, through a role.
          </Fine>
        </Part>
        <Part title="Groups in it">
          {custody.groupIds.length === 0 && <None />}
          {custody.groupIds.map((groupId) => (
            <Row
              key={groupId}
              aside={
                <Muted>
                  {plural(
                    index.groups.find((group) => group.id === groupId)?.memberIds.length ?? 0,
                    "member",
                  )}
                </Muted>
              }
            >
              <RecordLink kind="groups" id={groupId} onSelect={onSelect}>
                {names.group(groupId)}
              </RecordLink>
            </Row>
          ))}
        </Part>
      </Columns>
      <Part title="Current plugin output · open proposals" aside={String(custody.openCount)}>
        {placedProposals.length === 0 && (
          <None text="No open proposals currently placed in this set." />
        )}
        {placedProposals.slice(0, 8).map((proposal) => (
          <Row key={proposal.id} aside={<Muted>placed by custody rule</Muted>}>
            <Link to={`/requests?id=${encodeURIComponent(proposal.id)}`} className={linkClass}>
              {proposal.title}
            </Link>
          </Row>
        ))}
        {placedProposals.length > 8 && (
          <Fine>Showing 8 of {placedProposals.length} open proposals.</Fine>
        )}
        <Fine>
          Placement is calculated from Custody plugin output. Change the rule on Plugins; manage
          this set's members here.
        </Fine>
      </Part>
    </RecordFrame>
  );
}
