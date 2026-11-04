// Access records in Users management's detail pane. Everything comes with
// its provenance (permissions.md §6): a user's roles and how each is held, how they sign in, their
// groups, the custody and projects they hold directly or via which group, and every permission
// with the roles it comes from; a role's holders, the Identity mappings that give it and its
// grants; what joining a group gives, never a role; a custody's members, what each can do with
// its proposals, and the rule that places proposals in it. Category custody is shown here and
// changed on Categories; mappings and Custody rules on Plugins.

import type { AccessIndex } from "@vera/contract/access";
import type {
  AccessGroup,
  AccessUser,
  CustodyRecord,
  EffectivePermission,
  Identity,
  Role,
  RoleWay,
} from "@vera/domain/access";
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
} from "@vera/domain/access";
import type { GrantScope, Permission } from "@vera/domain/permissions";
import { byCatalogOrder, catalogEntryOf, permissionGroups } from "@vera/domain/permissions";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AgentBadge, SuspendedBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import type { AccessSelection, AccessSelectionKind } from "@/features/access/access-view";
import {
  confersText,
  permissionLineOf,
  viaText,
  waysShortText,
} from "@/features/access/access-words";
import { pluginInstanceHrefOf } from "@/features/plugins/plugins-view";
import { i18n } from "@/i18n";
import { formatLongDay } from "@/lib/format-date";
import { agoText } from "@/lib/format-moment";
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
      <h3 className="mb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-1.5 text-ui last:border-b-0">
      <div className="min-w-0">{children}</div>
      {aside !== undefined && <div className="ml-auto min-w-0 text-right">{aside}</div>}
    </div>
  );
}

function None({ text }: { text?: string }) {
  const { t } = useTranslation("access");
  return <p className="text-xs text-muted-foreground">{text ?? t("record.none")}</p>;
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

function HandTag() {
  const { t } = useTranslation("access");
  return (
    <span className="rounded-full bg-tone-purple px-2 py-px text-caption text-tone-purple-foreground">
      {t("record.byHand")}
    </span>
  );
}

// How a role reaches the person, each way: "by hand", "mapped by MZK Keycloak from …".
function Ways({ ways, names }: { ways: readonly RoleWay[]; names: AccessNames }) {
  const { t } = useTranslation("access");
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1">
      {ways.map((way, position) => (
        <span key={way.by === "hand" ? "hand" : `${way.instanceId}:${way.claim}`}>
          {position > 0 && <Muted>{t("record.and")} </Muted>}
          {way.by === "hand" ? (
            <HandTag />
          ) : (
            <>
              {t("record.mappedBy")}{" "}
              <Link to={pluginInstanceHrefOf(way.instanceId)} className={linkClass}>
                {names.instance(way.instanceId)}
              </Link>{" "}
              <Muted>{t("record.fromClaim", { claim: way.claim })}</Muted>
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
  const { t } = useTranslation("access");
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-2xs",
        scope === null ? "bg-muted text-muted-foreground" : scopeTones[scope],
      )}
    >
      {t(`record.scope.${scope ?? "own"}`)}
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
            <h4 className="mb-1 text-xs font-semibold">
              {i18n.t(`access:record.permissionGroup.${group}`)}
            </h4>
            {inGroup.map((row) => (
              <div
                key={row.permission}
                title={permissionLineOf(row.permission)}
                className="flex flex-wrap items-baseline gap-1.5 border-b py-0.5 text-xs"
              >
                <span className="font-mono text-caption">{row.permission}</span>
                <ScopePill scope={row.scope} />
                {row.from !== undefined && <span className="ml-auto text-caption">{row.from}</span>}
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
  const { t } = useTranslation("access");
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
    groupId === null ? (
      <Muted>{t(`via.${direct}`)}</Muted>
    ) : (
      <Muted>{t("via.group", { name: names.group(groupId) })}</Muted>
    );

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
        user.kind === "agent"
          ? user.entry === null
            ? t("record.agentDescription")
            : t("record.agentEntryDescription", { entry: user.entry })
          : user.email
      }
      actions={actions}
    >
      {user.suspendedAt !== null && (
        <StatusNote
          tone="red"
          title={t("record.suspended", { date: formatLongDay(user.suspendedAt) })}
          className="mb-1"
        >
          {t("record.suspendedDescription")}
        </StatusNote>
      )}
      {held.length === 0 && (
        <StatusNote tone="amber" title={t("record.noAccessYet")} className="mb-1">
          {firstIdentity === undefined
            ? t("record.noRolesSeeNothing")
            : t("record.noAccessViaIdentity", {
                instance: names.instance(firstIdentity.instanceId),
              })}{" "}
          {t("record.giveRole")}
        </StatusNote>
      )}
      <Columns>
        <div>
          <Part title={t("record.rolesAndHow")}>
            {held.length === 0 && <None />}
            {held.map(({ roleId, ways }) => (
              <Row key={roleId} aside={<Ways ways={ways} names={names} />}>
                <RecordLink kind="roles" id={roleId} onSelect={onSelect}>
                  {names.role(roleId)}
                </RecordLink>
              </Row>
            ))}
            {held.some(({ ways }) => ways.length > 1) && <Fine>{t("record.heldTwoWays")}</Fine>}
            {held.some(({ ways }) => ways.some((way) => way.by === "mapped")) && (
              <Fine>{t("record.mappedRoles")}</Fine>
            )}
          </Part>
          <Part title={t("record.signsInWith")}>
            {user.identities.length === 0 && (
              <None
                text={
                  user.kind === "agent" ? t("record.agentNoIdentity") : t("record.noIdentityLinked")
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
                        ? t("record.neverLoggedIn")
                        : t("record.lastLoggedIn", {
                            ago: agoText(identity.lastLoginAt, index.asOf),
                          })}
                    </Muted>
                    {onUnlink !== undefined && user.identities.length > 1 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="ml-2 h-auto p-0 text-xs"
                        onClick={() => onUnlink(identity)}
                      >
                        {t("record.unlink")}
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
          <Part title={t("record.groups")}>
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
          <Part title={t("record.requestCustody")}>
            {custodies.length === 0 && <None />}
            {custodies.map(({ custodyId, via: by }) => (
              <Row key={`${custodyId}:${by}`} aside={via(by, "member")}>
                <RecordLink kind="custodies" id={custodyId} onSelect={onSelect}>
                  {names.custody(custodyId)}
                </RecordLink>
              </Row>
            ))}
            {custodies.length > 0 && reach === null && <Fine>{t("record.memberNoRoleReach")}</Fine>}
          </Part>
          <Part title={t("record.projects")}>
            <ProjectRows user={user} index={index} names={names} />
          </Part>
        </div>
      </Columns>
      <Part
        title={t("record.whatTheyCanDo")}
        aside={t("record.permissionCountAndSource", { count: permissions.length })}
      >
        {permissions.length === 0 ? (
          <None text={t("record.nothing")} />
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
          aside={
            <Muted>
              {typeof via === "string"
                ? via
                : i18n.t("access:via.group", { name: names.group(via.groupId) })}
            </Muted>
          }
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
  const { t } = useTranslation("access");
  return (
    <Part title={t("record.categoryCustody")}>
      {held.length === 0 && <None />}
      {held.map(({ categoryId, key, aside }) => (
        <Row key={key} aside={aside}>
          <Link to={`/categories?c=${encodeURIComponent(categoryId)}`} className={linkClass}>
            {names.category(categoryId)}
          </Link>{" "}
          <Muted>{t("record.everythingUnderIt")}</Muted>
        </Row>
      ))}
      <Fine>
        {t("record.categoryCustodyGrantedOn")}{" "}
        <Link to="/categories" className={linkClass}>
          {t("record.categories")}
        </Link>
        {t("record.fromBranchNotHere")}
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
  const { t } = useTranslation("access");
  const holders = holdersOf(index.users, role.id);
  const included = includedRolesOf(index.roles, role);
  const mappings = mappingsOf(index.identityInstances, role.id);
  return (
    <RecordFrame
      title={role.name}
      badge={
        <ToneBadge tone={role.isShipped ? "slate" : "blue"} className="px-1.5 py-0 text-2xs">
          {t(role.isShipped ? "record.shipped" : "record.custom")}
        </ToneBadge>
      }
      sub={
        <>
          {role.description}
          {included.length > 0 && (
            <>
              {role.description !== "" && " · "}
              {t("record.includesEverything")}{" "}
              {included.map((other, position) => (
                <span key={other.id}>
                  {position > 0 && ` ${t("record.and")} `}
                  <RecordLink kind="roles" id={other.id} onSelect={onSelect}>
                    {other.name}
                  </RecordLink>
                </span>
              ))}{" "}
              {t("record.has")}
            </>
          )}
        </>
      }
      actions={actions}
    >
      <Columns>
        <Part title={t("record.heldBy")} aside={String(holders.length)}>
          {holders.length === 0 && <None text={t("record.nobody")} />}
          {holders.map(({ user, ways }) => (
            <Row key={user.id} aside={<Ways ways={ways} names={names} />}>
              <RecordLink kind="users" id={user.id} onSelect={onSelect}>
                {user.name}
              </RecordLink>
            </Row>
          ))}
        </Part>
        <Part title={t("record.mappedByIdentityProviders")}>
          {mappings.length === 0 && <None text={t("record.noMappingOnlyHand")} />}
          {mappings.map(({ instanceId, claim }) => (
            <Row
              key={`${instanceId}:${claim}`}
              aside={<Muted>{claim ?? t("record.defaultRoleEveryone")}</Muted>}
            >
              <Link to={pluginInstanceHrefOf(instanceId)} className={linkClass}>
                {names.instance(instanceId)}
              </Link>
            </Row>
          ))}
          <Fine>
            {t("record.mappingsSetOnIdentity")}{" "}
            <Link to="/plugins?kind=Identity" className={linkClass}>
              {t("record.plugins")}
            </Link>
            .
          </Fine>
        </Part>
      </Columns>
      <Part
        title={t("record.proposalSubmissionLimit")}
        aside={
          role.proposalBatchLimit === null
            ? t("record.unlimited")
            : t("record.items", { count: role.proposalBatchLimit })
        }
      >
        <Fine>{t("record.proposalSubmissionLimitDescription")}</Fine>
      </Part>
      <Part
        title={t("record.proposalDailyLimit")}
        aside={
          role.proposalDailyLimit === null
            ? t("record.unlimited")
            : t("record.items", { count: role.proposalDailyLimit })
        }
      >
        <Fine>{t("record.proposalDailyLimitDescription")}</Fine>
      </Part>
      <Part
        title={t("record.grants")}
        aside={t("record.grantsDescription", { count: role.grants.length })}
      >
        {role.grants.length === 0 ? (
          <None text={t("record.noGrantsSeeNothing")} />
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
  const { t } = useTranslation("access");
  const custodies = index.custodies.filter((custody) => custody.groupIds.includes(group.id));
  const projects = index.projects.filter((project) => project.memberGroupIds.includes(group.id));
  const members = index.users.filter((user) => group.memberIds.includes(user.id));
  return (
    <RecordFrame title={group.name} sub={group.description} actions={actions}>
      <StatusNote tone="blue" title={t("record.addingGivesThem")}>
        {confersText({
          categoryNames: group.categoryIds.map(names.category),
          custodyNames: custodies.map(({ name }) => name),
          projectNames: projects.map(({ name }) => name),
        })}
        .
      </StatusNote>
      <Columns>
        <Part title={t("record.members")} aside={String(members.length)}>
          {members.length === 0 && <None text={t("record.nobodyYet")} />}
          {members.map((user) => {
            const roleIds = heldRoleIdsOf(user);
            return (
              <Row
                key={user.id}
                aside={
                  <Muted>
                    {roleIds.length === 0 ? t("record.noRole") : roleIds.map(names.role).join(", ")}
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
          <Fine>{t("record.groupRolesDescription")}</Fine>
        </Part>
        <div>
          <CategoryCustodyPart
            held={group.categoryIds.map((categoryId) => ({ categoryId, key: categoryId }))}
            names={names}
          />
          <Part title={t("record.requestCustody")}>
            {custodies.length === 0 && <None />}
            {custodies.map((custody) => (
              <Row
                key={custody.id}
                aside={<Muted>{t("record.openCount", { count: custody.openCount })}</Muted>}
              >
                <RecordLink kind="custodies" id={custody.id} onSelect={onSelect}>
                  {custody.name}
                </RecordLink>
              </Row>
            ))}
          </Part>
          <Part title={t("record.projects")}>
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

export function CustodyRecordView({
  index,
  names,
  onSelect,
  actions,
  custody,
}: RecordProps & { custody: CustodyRecord }) {
  const { t } = useTranslation("access");
  const members = custodyMembersOf(custody, index.groups);
  const placedProposals = index.proposals.filter((proposal) =>
    proposal.custodyIds.includes(custody.id),
  );
  return (
    <RecordFrame
      title={custody.name}
      badge={
        custody.isFallback ? (
          <ToneBadge tone="amber" className="px-1.5 py-0 text-2xs">
            {t("record.fallback")}
          </ToneBadge>
        ) : undefined
      }
      sub={
        <>
          {custody.description}
          {custody.description !== "" && " · "}
          <Link to={`/requests?custody=${encodeURIComponent(custody.id)}`} className={linkClass}>
            {t("record.openProposalCount", { count: custody.openCount })}
          </Link>
        </>
      }
      actions={actions}
    >
      <StatusNote
        tone="blue"
        title={custody.isFallback ? t("record.fallbackTitle") : t("record.ruleTitle")}
      >
        {custody.isFallback ? (
          t("record.fallbackDescription")
        ) : custody.placedByIds.length > 0 ? (
          <>
            {t("record.placedBy")}{" "}
            {custody.placedByIds.map((instanceId, position) => (
              <span key={instanceId}>
                {position > 0 && ", "}
                <Link to={pluginInstanceHrefOf(instanceId)} className={linkClass}>
                  {names.instance(instanceId)}
                </Link>
              </span>
            ))}
            {t("record.placedByDescription")}
          </>
        ) : (
          t("record.noRuleNamesIt")
        )}
      </StatusNote>
      <Columns>
        <Part title={t("record.members")} aside={String(members.length)}>
          {members.length === 0 && <None text={t("record.nobody")} />}
          {members.map(({ userId, via }) => {
            const user = index.users.find((candidate) => candidate.id === userId);
            const reach =
              user === undefined ? null : requestReachOf(index.roles, heldRoleIdsOf(user));
            return (
              <Row
                key={userId}
                aside={
                  reach === null ? (
                    <span className="text-tone-amber-foreground">
                      {t("record.noRoleReachesIt")}
                    </span>
                  ) : (
                    <Muted>{t(`record.reach.${reach}`)}</Muted>
                  )
                }
              >
                <RecordLink kind="users" id={userId} onSelect={onSelect}>
                  {names.user(userId)}
                </RecordLink>{" "}
                <Muted>
                  {via
                    .map((way) => viaText(way, names.group, "direct"))
                    .join(` ${t("record.and")} `)}
                </Muted>
              </Row>
            );
          })}
          <Fine>
            {t("record.membershipCapability")} <span className="font-mono">request.decide</span>,
            {t("record.andSeesOnlyWith")} <span className="font-mono">request.read</span>
            {t("record.throughRole")}
          </Fine>
        </Part>
        <Part title={t("record.groupsInIt")}>
          {custody.groupIds.length === 0 && <None />}
          {custody.groupIds.map((groupId) => (
            <Row
              key={groupId}
              aside={
                <Muted>
                  {t("record.memberCount", {
                    count:
                      index.groups.find((group) => group.id === groupId)?.memberIds.length ?? 0,
                  })}
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
      <Part title={t("record.currentPluginOutput")} aside={String(custody.openCount)}>
        {placedProposals.length === 0 && <None text={t("record.noOpenProposalsPlaced")} />}
        {placedProposals.slice(0, 8).map((proposal) => (
          <Row key={proposal.id} aside={<Muted>{t("record.placedByCustodyRule")}</Muted>}>
            <Link to={`/requests?id=${encodeURIComponent(proposal.id)}`} className={linkClass}>
              {proposal.title}
            </Link>
          </Row>
        ))}
        {placedProposals.length > 8 && (
          <Fine>{t("record.showingOpenProposals", { count: placedProposals.length })}</Fine>
        )}
        <Fine>{t("record.placementDescription")}</Fine>
      </Part>
    </RecordFrame>
  );
}
