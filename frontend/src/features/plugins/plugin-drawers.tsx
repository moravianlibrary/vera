// What Plugins' drawer shows (docs/demos/shared/page-plugins.js `openImpl`, `openInst`; STATUS
// "Plugins"). An implementation opens its contract: what it supplies and at which tier, a
// registry's mapping, a harvester's agent, a validation's rules, the identifiers it resolves,
// a generator's class, the triggers it accepts, the fields an instance is configured with, the
// versions installed and its instances; its tiers, copy states and agent are each instance's
// defaults (PLG-upgrade). An instance opens its configuration (never a secret), VERA's settings
// on it, its own tiers, copy states and agent, when it runs (its schedules are shown here and edited only on
// Schedules), its recent runs from Tasks and what it supplies.

import type {
  InstanceSettings,
  PluginImplementation,
  PluginInstanceDetail,
  PluginVersion,
} from "@vera/contract/plugins";
import type { InstancePolicy } from "@vera/domain/plugins";
import { isRunnableContract } from "@vera/domain/plugins";
import { schedulableKinds } from "@vera/domain/schedules";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { CompactTable } from "@/components/compact-table";
import type { Fact } from "@/components/detail-card";
import { DetailCard, DetailRow, FactGrid, FinePrint, Muted } from "@/components/detail-card";
import { RunStateBadge } from "@/components/run-state-badge";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import {
  InstanceStateBadge,
  KindBadge,
  runsText,
  SupplyChips,
} from "@/features/plugins/plugin-table";
import {
  entryPointText,
  generatorClassText,
  operationText,
  personReachText,
  suppliesOf,
  triggerLabels,
} from "@/features/plugins/plugin-words";
import { RunOverlayLink } from "@/features/tasks/run-overlay-link";
import { i18n } from "@/i18n";
import { cadenceText } from "@/lib/format-cadence";
import { formatCalendarDay, formatLongCalendarDay } from "@/lib/format-date";
import { agoText, dayAndTimeOf, shortDayOf } from "@/lib/format-moment";

const linkClass = "text-primary underline-offset-2 hover:underline";

// What the drawer may link to, by what the person holds.
export interface DrawerReach {
  canSeeTasks: boolean;
  canSeeAccess: boolean;
  canSeeHooks: boolean;
}

export interface DrawerNames {
  userOf: (userId: string) => string;
  categoryOf: (categoryId: string) => string;
  roleOf: (roleId: string) => string;
  // A request custody's name; undefined once it is deleted.
  custodyOf: (custodyId: string) => string | undefined;
}

// ACCESS-custody-by-plugins: the one custody its condition places into, by id, so a rename
// follows; once deleted it places nothing until another is picked (ACCESS-custody-delete).
function CustodyCard({
  custodyId,
  names,
  reach,
}: {
  custodyId: string;
  names: DrawerNames;
  reach: DrawerReach;
}) {
  const name = names.custodyOf(custodyId);
  return (
    <DetailCard title={i18n.t("plugins:pluginDrawers.placesInto")}>
      <DetailRow>
        {name === undefined ? (
          <Muted>{i18n.t("plugins:pluginDrawers.custodyDeleted")}</Muted>
        ) : reach.canSeeAccess ? (
          <Link to={`/access?c=${encodeURIComponent(custodyId)}`} className={linkClass}>
            {name}
          </Link>
        ) : (
          name
        )}
      </DetailRow>
      <FinePrint>{i18n.t("plugins:pluginDrawers.custodyFinePrint")}</FinePrint>
    </DetailCard>
  );
}

// ---------------------------------------------------------------- an implementation

interface ImplementationDrawerProps {
  implementation: PluginImplementation;
  instances: readonly PluginInstanceDetail[];
  onOpenInstance: (instanceId: string) => void;
  names: DrawerNames;
  actions: readonly ViewAction[];
  // What was just done to it, said on top.
  notice?: ReactNode;
}

export function implementationSubtitle(implementation: PluginImplementation): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <KindBadge kind={implementation.kind} />
      <span className="font-mono">v{implementation.versions[0]?.version}</span> ·{" "}
      {i18n.t("plugins:pluginDrawers.implementation")}
    </span>
  );
}

export function ImplementationDrawer({
  implementation,
  instances,
  onOpenInstance,
  names,
  actions,
  notice,
}: ImplementationDrawerProps) {
  const [newest] = implementation.versions;
  return (
    <div className="grid gap-4 text-ui">
      {notice}
      <p>{implementation.description}</p>
      {newest !== undefined && <Contract version={newest} kind={implementation.kind} />}

      <DetailCard
        title={i18n.t("plugins:pluginDrawers.versionsInstalled", {
          count: implementation.versions.length,
        })}
      >
        {implementation.versions.map((version) => {
          const running = instances.filter((instance) => instance.version === version.version);
          return (
            <DetailRow
              key={version.version}
              aside={
                isRunnableContract(version.contractVersion) ? (
                  <Muted>
                    {i18n.t("plugins:pluginDrawers.instanceCount", { count: running.length })}
                  </Muted>
                ) : (
                  <ToneBadge tone="amber">
                    {i18n.t("plugins:pluginDrawers.contractVersion", {
                      version: version.contractVersion,
                    })}
                  </ToneBadge>
                )
              }
            >
              <span className="font-mono">v{version.version}</span>{" "}
              <Muted>
                · {formatCalendarDay(version.installedAt)} · {names.userOf(version.installedBy)} ·{" "}
                {i18n.t("plugins:pluginDrawers.signedBy", { signer: version.signer })}
              </Muted>
            </DetailRow>
          );
        })}
        {implementation.versions.some(
          (version) => !isRunnableContract(version.contractVersion),
        ) && <FinePrint>{i18n.t("plugins:pluginDrawers.otherContract")}</FinePrint>}
      </DetailCard>

      <DetailCard title={i18n.t("plugins:pluginDrawers.instances", { count: instances.length })}>
        {instances.length === 0 ? (
          <Muted>{i18n.t("plugins:pluginDrawers.noneConfigured")}</Muted>
        ) : (
          instances.map((instance) => (
            <DetailRow key={instance.id} aside={<InstanceStateBadge instance={instance} />}>
              <button
                type="button"
                className={linkClass}
                onClick={() => onOpenInstance(instance.id)}
              >
                {instance.name}
              </button>
              {instance.version !== newest?.version && (
                <Muted>
                  {" "}
                  · <span className="font-mono">v{instance.version}</span>
                </Muted>
              )}
            </DetailRow>
          ))
        )}
      </DetailCard>

      <ActionBar actions={actions} />
    </div>
  );
}

function Contract({
  version,
  kind,
}: {
  version: PluginVersion;
  kind: PluginImplementation["kind"];
}) {
  const { declares } = version;
  const hasUnmapped = declares.rawStates.some((state) => state.state === null);
  return (
    <>
      {declares.properties.length > 0 && (
        <DetailCard title={i18n.t("plugins:pluginDrawers.propertiesSupplied")}>
          {declares.properties.map((property) => (
            <DetailRow
              key={property.key}
              aside={<Muted>{i18n.t("plugins:pluginDrawers.tier", { tier: property.tier })}</Muted>}
            >
              <span className="font-mono">{property.key}</span>
            </DetailRow>
          ))}
          <FinePrint>
            {i18n.t("plugins:pluginDrawers.propertyFinePrint")} <code>manual</code>
            {i18n.t("plugins:pluginDrawers.manualTierAfter")}
          </FinePrint>
        </DetailCard>
      )}
      {declares.rawStates.length > 0 && (
        <DetailCard title={i18n.t("plugins:pluginDrawers.registryMapping")}>
          <CompactTable
            rows={declares.rawStates}
            rowKey={(state) => state.raw}
            className="text-ui"
            columns={[
              {
                key: "raw",
                header: i18n.t("plugins:pluginDrawers.raw"),
                cell: (state) => <span className="font-mono text-xs">{state.raw}</span>,
              },
              {
                key: "state",
                header: i18n.t("plugins:pluginDrawers.state"),
                cell: (state) =>
                  state.state ?? (
                    <span className="text-tone-amber-foreground">
                      {i18n.t("plugins:pluginDrawers.unmapped")}
                    </span>
                  ),
              },
              {
                key: "copy",
                header: i18n.t("plugins:pluginDrawers.existingCopyDefault"),
                cell: (state) =>
                  state.isExistingCopy ? (
                    <span className="text-tone-purple-foreground">
                      {i18n.t("plugins:pluginDrawers.counts")}
                    </span>
                  ) : (
                    <Muted>—</Muted>
                  ),
              },
            ]}
          />
          {hasUnmapped && (
            <StatusNote
              tone="amber"
              title={i18n.t("plugins:pluginDrawers.unmappedPurpose")}
              className="mt-3"
            >
              {i18n.t("plugins:pluginDrawers.unmappedFinePrint")}
            </StatusNote>
          )}
        </DetailCard>
      )}
      {declares.agent !== null && (
        <DetailCard title={i18n.t("plugins:pluginDrawers.agentDefault")}>
          <FactGrid
            facts={[
              { label: i18n.t("plugins:pluginDrawers.name"), value: declares.agent.name },
              {
                label: i18n.t("plugins:pluginDrawers.entryPoint"),
                value: entryPointText(declares.agent.entryPoint),
              },
            ]}
          />
          <FinePrint>
            {declares.agent.entryPoint === "proposals"
              ? i18n.t("plugins:pluginDrawers.agentProposals")
              : i18n.t("plugins:pluginDrawers.agentAdditions")}
          </FinePrint>
        </DetailCard>
      )}
      {declares.rules.length > 0 && (
        <DetailCard title={i18n.t("plugins:pluginDrawers.rules")}>
          {declares.rules.map((rule) => (
            <DetailRow key={rule.code}>
              <span className="font-mono">{rule.code}</span> {rule.label}
            </DetailRow>
          ))}
          <FinePrint>{i18n.t("plugins:pluginDrawers.rulesFinePrint")}</FinePrint>
        </DetailCard>
      )}
      <DetailCard title={i18n.t("plugins:pluginDrawers.whatDeclared")}>
        <FactGrid facts={declaredFacts(version, kind)} />
      </DetailCard>
    </>
  );
}

function declaredFacts(version: PluginVersion, kind: PluginImplementation["kind"]): Fact[] {
  const { declares } = version;
  return [
    ...(declares.identifierTypes.length > 0
      ? [
          {
            label: i18n.t("plugins:pluginDrawers.identifiersResolved"),
            value: declares.identifierTypes.join(" · "),
          },
        ]
      : []),
    ...(declares.generatorClass === null
      ? []
      : [
          {
            label: i18n.t("plugins:pluginDrawers.class"),
            value:
              declares.generatorClass === "AiBased"
                ? i18n.t("plugins:pluginDrawers.generatorAi", {
                    class: generatorClassText(declares.generatorClass),
                  })
                : i18n.t("plugins:pluginDrawers.generatorRule", {
                    class: generatorClassText(declares.generatorClass),
                  }),
          },
        ]),
    ...(declares.channelInterface === null
      ? []
      : [
          {
            label: i18n.t("plugins:pluginDrawers.interface"),
            value: declares.channelInterface.toLowerCase(),
          },
        ]),
    // PLG-declares: how it reaches a person, which makes it a watchlist channel.
    ...(declares.personReach === undefined || declares.personReach === null
      ? []
      : [
          {
            label: i18n.t("plugins:pluginDrawers.reachesPerson"),
            value: personReachText(declares.personReach),
          },
        ]),
    ...(declares.operations === undefined || declares.operations.length === 0
      ? []
      : [
          {
            label: i18n.t(
              kind === "Input" ? "plugins:pluginDrawers.wayIn" : "plugins:pluginDrawers.can",
            ),
            value: declares.operations.map(operationText).join(", "),
          },
        ]),
    {
      label: i18n.t("plugins:pluginDrawers.runs"),
      value: version.triggers.map((trigger) => i18n.t(triggerLabels[trigger])).join(", "),
    },
    {
      label: i18n.t("plugins:pluginDrawers.configuredWith"),
      value:
        version.configFields.length === 0
          ? i18n.t("plugins:pluginDrawers.nothing")
          : version.configFields
              .map(
                (field) =>
                  `${field.key}${field.isSecret ? ` (${i18n.t("plugins:pluginDrawers.secret")})` : ""}${field.isRequired ? "" : ` (${i18n.t("plugins:pluginDrawers.optional")})`}`,
              )
              .join(", "),
    },
    { label: i18n.t("plugins:pluginDrawers.contract"), value: version.contractVersion },
  ];
}

// ---------------------------------------------------------------- an instance

interface InstanceDrawerProps {
  instance: PluginInstanceDetail;
  implementation: PluginImplementation;
  asOf: string;
  names: DrawerNames;
  reach: DrawerReach;
  onOpenImplementation: () => void;
  actions: readonly ViewAction[];
  // What was just done to it, said on top.
  notice?: ReactNode;
}

// Plain words: the contract is opened from inside the drawer, so the drawer does not open with
// its focus on a link.
export function instanceSubtitle(
  instance: PluginInstanceDetail,
  implementation: PluginImplementation,
): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {implementation.name} <span className="font-mono">v{instance.version}</span> ·
      <KindBadge kind={implementation.kind} />
    </span>
  );
}

export function InstanceDrawer({
  instance,
  implementation,
  asOf,
  names,
  reach,
  onOpenImplementation,
  actions,
  notice,
}: InstanceDrawerProps) {
  const version = implementation.versions.find(
    (candidate) => candidate.version === instance.version,
  );
  const isRunnable = (schedulableKinds as readonly string[]).includes(instance.kind);
  const configuration = [
    ...Object.entries(instance.configuration),
    ...instance.secretsSet.map((key) => [key, "•••"] as const),
  ];
  return (
    <div className="grid gap-4 text-ui">
      {notice}
      {!instance.isEnabled && (
        <StatusNote tone="slate" title={i18n.t("plugins:pluginDrawers.disabled")}>
          {i18n.t("plugins:pluginDrawers.disabledFinePrint")}
        </StatusNote>
      )}

      <DetailCard title={i18n.t("plugins:pluginDrawers.configuration")}>
        <pre
          data-swipe="off"
          className="mb-3 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-caption leading-relaxed whitespace-pre-wrap"
        >
          {configuration.length === 0
            ? "—"
            : configuration.map(([key, value]) => `${key} = ${value}`).join("\n")}
        </pre>
        <FactGrid
          facts={[
            {
              label: i18n.t("plugins:pluginDrawers.linkedTo"),
              value:
                instance.linkedCategoryId === null
                  ? i18n.t("plugins:pluginDrawers.allCategories")
                  : names.categoryOf(instance.linkedCategoryId),
            },
            {
              label: i18n.t("plugins:pluginDrawers.created"),
              value: `${formatLongCalendarDay(instance.createdAt)} · ${names.userOf(instance.createdBy)}`,
            },
          ]}
        />
      </DetailCard>

      {instance.kind === "DeliveryChannel" && reach.canSeeHooks && (
        <DetailCard
          title={i18n.t("plugins:pluginDrawers.hooksSending", { count: instance.hooks.length })}
        >
          {instance.hooks.length === 0 ? (
            <Muted>{i18n.t("plugins:pluginDrawers.noHooksUseChannel")}</Muted>
          ) : (
            instance.hooks.map((hook) => (
              <DetailRow key={hook.id} aside={<Muted>{hook.state}</Muted>}>
                <Link to={`/hooks?h=${encodeURIComponent(hook.id)}`} className={linkClass}>
                  {hook.name}
                </Link>
              </DetailRow>
            ))
          )}
        </DetailCard>
      )}

      {instance.settings !== null && (
        <SettingsCard settings={instance.settings} names={names} reach={reach} />
      )}

      {version !== undefined && <PolicyCard policy={instance.policy} version={version} />}

      <DetailCard title={i18n.t("plugins:pluginDrawers.whenRuns")}>
        <FactGrid
          facts={[
            ...(instance.triggers.length > 0
              ? [
                  {
                    label: i18n.t("plugins:pluginDrawers.on"),
                    value: instance.triggers
                      .map((trigger) => i18n.t(triggerLabels[trigger]))
                      .join(", "),
                  },
                ]
              : []),
            ...instance.schedules.map((schedule) => ({
              label: i18n.t("plugins:pluginDrawers.scheduled"),
              value: (
                <>
                  {cadenceText(schedule.cadence)}
                  {schedule.isPaused && <Muted> · {i18n.t("plugins:pluginDrawers.paused")}</Muted>}
                  {reach.canSeeTasks && (
                    <>
                      {" · "}
                      <Link
                        to={`/schedules?s=${encodeURIComponent(schedule.id)}`}
                        className={linkClass}
                      >
                        {i18n.t("plugins:pluginDrawers.editSchedules")}
                      </Link>
                    </>
                  )}
                </>
              ),
            })),
          ]}
        />
        {isRunnable && instance.schedules.length === 0 && (
          <FinePrint>
            {i18n.t("plugins:pluginDrawers.noSchedule", {
              when:
                instance.triggers.length === 0
                  ? i18n.t("plugins:pluginDrawers.byHand")
                  : runsText(instance),
            })}
            {reach.canSeeTasks && (
              <>
                {" "}
                <Link to="/schedules" className={linkClass}>
                  {i18n.t("plugins:pluginDrawers.addSchedule")}
                </Link>
                .
              </>
            )}
          </FinePrint>
        )}
      </DetailCard>

      {(isRunnable || instance.recentRuns.length > 0) && (
        <RecentRunsCard instance={instance} asOf={asOf} reach={reach} />
      )}

      <DetailCard title={i18n.t("plugins:pluginDrawers.whatSupplies")}>
        {version === undefined || suppliesOf(version).length === 0 ? (
          <Muted>{i18n.t("plugins:pluginDrawers.noDeclarations")}</Muted>
        ) : (
          <SupplyChips items={suppliesOf(version)} />
        )}
        <FinePrint>
          {i18n.t("plugins:pluginDrawers.declaredByImplementation")}{" "}
          <button type="button" className={linkClass} onClick={onOpenImplementation}>
            {i18n.t("plugins:pluginDrawers.seeContract")}
          </button>
          .
        </FinePrint>
      </DetailCard>

      <ActionBar actions={actions} />
    </div>
  );
}

function RecentRunsCard({
  instance,
  asOf,
  reach,
}: {
  instance: PluginInstanceDetail;
  asOf: string;
  reach: DrawerReach;
}) {
  const title = i18n.t("plugins:pluginDrawers.recentRuns", { count: instance.runCount });
  return (
    <DetailCard
      title={title}
      action={
        reach.canSeeTasks && instance.runCount > 0 ? (
          <Link
            to={`/tasks?plugin=${encodeURIComponent(instance.id)}`}
            className={`${linkClass} text-xs`}
          >
            {i18n.t("plugins:pluginDrawers.allTasks")}
          </Link>
        ) : undefined
      }
    >
      {instance.mirror !== null && (
        <DetailRow>
          {instance.mirror.syncedAt === null
            ? i18n.t("plugins:pluginDrawers.mirrorNotSynced")
            : i18n.t("plugins:pluginDrawers.mirrorSynced", {
                count: instance.mirror.records,
                date: dayAndTimeOf(instance.mirror.syncedAt),
              })}
        </DetailRow>
      )}
      {instance.recentRuns.length === 0 ? (
        <Muted>
          {instance.lastRunAt === null
            ? i18n.t("plugins:pluginDrawers.neverRun")
            : i18n.t("plugins:pluginDrawers.expiredRun", { date: shortDayOf(instance.lastRunAt) })}
        </Muted>
      ) : (
        instance.recentRuns.map((run) => (
          <DetailRow key={run.id} aside={<RunStateBadge run={run} />}>
            {reach.canSeeTasks ? (
              <RunOverlayLink runId={run.id} className={linkClass}>
                {run.what}
              </RunOverlayLink>
            ) : (
              run.what
            )}
            <div className="text-xs text-muted-foreground">
              {agoText(run.startedAt, asOf)}
              {run.changes !== null &&
                run.changes.length > 0 &&
                ` · ${run.changes.map((change) => change.label).join(", ")}`}
            </div>
          </DetailRow>
        ))
      )}
    </DetailCard>
  );
}

// PLG-upgrade: what this instance sets, beside what its version declares.
function PolicyCard({ policy, version }: { policy: InstancePolicy; version: PluginVersion }) {
  const { declares } = version;
  if (
    declares.properties.length === 0 &&
    declares.rawStates.length === 0 &&
    policy.agent === null
  ) {
    return null;
  }

  const declaredTierOf = (key: string) =>
    declares.properties.find((property) => property.key === key)?.tier;
  return (
    <DetailCard title={i18n.t("plugins:pluginDrawers.policy")}>
      {policy.tiers.map(({ key, tier }) => (
        <DetailRow
          key={key}
          aside={
            <Muted>
              {i18n.t("plugins:pluginDrawers.tier", { tier })}
              {declaredTierOf(key) !== tier &&
                ` · ${i18n.t("plugins:pluginDrawers.declaredTier", { tier: declaredTierOf(key) })}`}
            </Muted>
          }
        >
          <span className="font-mono">{key}</span>
        </DetailRow>
      ))}
      {declares.rawStates.length > 0 && (
        <DetailRow aside={<Muted>{i18n.t("plugins:pluginDrawers.countAsExistingCopy")}</Muted>}>
          {policy.copyStates.length === 0 ? (
            <Muted>{i18n.t("plugins:pluginDrawers.noState")}</Muted>
          ) : (
            <span className="font-mono text-xs">{policy.copyStates.join(", ")}</span>
          )}
        </DetailRow>
      )}
      {policy.agent !== null && (
        <DetailRow aside={<Muted>{entryPointText(policy.agent.entryPoint)}</Muted>}>
          {i18n.t("plugins:pluginDrawers.agentName", { name: policy.agent.name })}
        </DetailRow>
      )}
    </DetailCard>
  );
}

function SettingsCard({
  settings,
  names,
  reach,
}: {
  settings: InstanceSettings;
  names: DrawerNames;
  reach: DrawerReach;
}) {
  switch (settings.kind) {
    case "Identity":
      return (
        <DetailCard title={i18n.t("plugins:pluginDrawers.login")}>
          <FactGrid
            facts={[
              { label: i18n.t("plugins:pluginDrawers.button"), value: settings.label },
              { label: i18n.t("plugins:pluginDrawers.orderLogin"), value: settings.order },
              {
                label: i18n.t("plugins:pluginDrawers.userIdClaim"),
                value: <span className="font-mono">{settings.userIdClaim}</span>,
              },
              {
                label: i18n.t("plugins:pluginDrawers.newUserGets"),
                value:
                  settings.defaultRoleId === null
                    ? i18n.t("plugins:pluginDrawers.noRole")
                    : names.roleOf(settings.defaultRoleId),
              },
              {
                label: i18n.t("plugins:pluginDrawers.matchEmail"),
                value: settings.matchByEmail
                  ? i18n.t("plugins:pluginDrawers.matchEmailYes")
                  : i18n.t("plugins:pluginDrawers.no"),
              },
            ]}
          />
          <h4 className="mt-4 mb-1 text-xs font-medium text-muted-foreground">
            {i18n.t("plugins:pluginDrawers.claimsToRoles")}
          </h4>
          {settings.mappings.length === 0 ? (
            <Muted>{i18n.t("plugins:pluginDrawers.rolesGivenByHand")}</Muted>
          ) : (
            settings.mappings.map((mapping) => (
              <DetailRow key={mapping.claim} aside={names.roleOf(mapping.roleId)}>
                <span className="font-mono text-xs">{mapping.claim}</span>
              </DetailRow>
            ))
          )}
          <FinePrint>{i18n.t("plugins:pluginDrawers.roleClaimAppliedAtLogin")}</FinePrint>
        </DetailCard>
      );
    case "Custody":
      return <CustodyCard custodyId={settings.custodyId} names={names} reach={reach} />;
    case "Message":
    case "Classifier":
    case "Identifier":
      return (
        <DetailCard title={i18n.t("plugins:pluginDrawers.order")}>
          <FactGrid
            facts={[{ label: i18n.t("plugins:pluginDrawers.amongKind"), value: settings.order }]}
          />
          <FinePrint>
            {settings.kind === "Message"
              ? i18n.t("plugins:pluginDrawers.messageOrder")
              : settings.kind === "Identifier"
                ? i18n.t("plugins:pluginDrawers.identifierOrder")
                : i18n.t("plugins:pluginDrawers.classifierOrder")}
          </FinePrint>
        </DetailCard>
      );
  }
}
