// What Plugins' drawer shows (docs/demos/shared/page-plugins.js `openImpl`, `openInst`; STATUS
// "Plugins"). An implementation opens its contract: what it supplies and at which tier, a
// registry's mapping, a harvester's agent, a validation's rules, the identifiers it resolves,
// a generator's class, the triggers it accepts, the fields an instance is configured with, the
// versions installed and its instances. An instance opens its configuration (never a secret),
// VERA's settings on it, when it runs (its schedules are shown here and edited only on
// Schedules), its recent runs from Tasks and what it supplies.
// TODO(rrandiak): a delivery channel lists the hooks sending through it once Hooks exist (plan.md
// step 11). Labels move to i18n.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type {
  InstanceSettings,
  PluginImplementation,
  PluginInstanceDetail,
  PluginVersion,
} from "@/api/plugins";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import type { Fact } from "@/components/detail-card";
import { DetailCard, DetailRow, FactGrid, FinePrint, Muted } from "@/components/detail-card";
import { RunStateBadge } from "@/components/run-state-badge";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { isRunnableContract } from "@/domain/plugins";
import { schedulableKinds } from "@/domain/schedules";
import {
  InstanceStateBadge,
  KindBadge,
  runsText,
  SupplyChips,
} from "@/features/plugins/plugin-table";
import {
  entryPointText,
  generatorClassText,
  suppliesOf,
  triggerLabels,
} from "@/features/plugins/plugin-words";
import { cadenceText } from "@/lib/format-cadence";
import { formatCalendarDay } from "@/lib/format-date";
import { agoText, shortDayOf } from "@/lib/format-moment";
import { plural } from "@/lib/plural";

const linkClass = "text-primary underline-offset-2 hover:underline";

// What the drawer may link to, by what the person holds.
export interface DrawerReach {
  canSeeTasks: boolean;
  canSeeAccess: boolean;
}

export interface DrawerNames {
  userOf: (userId: string) => string;
  categoryOf: (categoryId: string) => string;
  roleOf: (roleId: string) => string;
  // A proposal custody's id, by its name; undefined when there is none.
  custodyIdOf: (name: string) => string | undefined;
}

// ---------------------------------------------------------------- an implementation

interface ImplementationDrawerProps {
  implementation: PluginImplementation;
  instances: readonly PluginInstanceDetail[];
  onOpenInstance: (instanceId: string) => void;
  names: DrawerNames;
  actions: readonly ViewAction[];
}

export function implementationSubtitle(implementation: PluginImplementation): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <KindBadge kind={implementation.kind} />
      <span className="font-mono">v{implementation.versions[0]?.version}</span> · implementation
    </span>
  );
}

export function ImplementationDrawer({
  implementation,
  instances,
  onOpenInstance,
  names,
  actions,
}: ImplementationDrawerProps) {
  const [newest] = implementation.versions;
  return (
    <div className="grid gap-4 text-[0.8125rem]">
      <p>{implementation.description}</p>
      {newest !== undefined && <Contract version={newest} />}

      <DetailCard title={`Versions installed · ${implementation.versions.length}`}>
        {implementation.versions.map((version) => {
          const running = instances.filter((instance) => instance.version === version.version);
          return (
            <DetailRow
              key={version.version}
              aside={
                isRunnableContract(version.contractVersion) ? (
                  <Muted>{plural(running.length, "instance")}</Muted>
                ) : (
                  <ToneBadge tone="amber">contract {version.contractVersion}</ToneBadge>
                )
              }
            >
              <span className="font-mono">v{version.version}</span>{" "}
              <Muted>
                · {formatCalendarDay(version.installedAt)} · {names.userOf(version.installedBy)}
              </Muted>
            </DetailRow>
          );
        })}
        {implementation.versions.some(
          (version) => !isRunnableContract(version.contractVersion),
        ) && (
          <FinePrint>
            A version built for another contract is installed but never runs: VERA runs contract
            1.x.
          </FinePrint>
        )}
      </DetailCard>

      <DetailCard title={`Instances · ${instances.length}`}>
        {instances.length === 0 ? (
          <Muted>None: it does nothing until one is configured.</Muted>
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

function Contract({ version }: { version: PluginVersion }) {
  const { declares } = version;
  const hasUnmapped = declares.rawStates.some((state) => state.state === null);
  return (
    <>
      {declares.properties.length > 0 && (
        <DetailCard title="Properties it supplies">
          {declares.properties.map((property) => (
            <DetailRow key={property.key} aside={<Muted>tier {property.tier}</Muted>}>
              <span className="font-mono">{property.key}</span>
            </DetailRow>
          ))}
          <FinePrint>
            The highest tier with a value wins. <code>manual</code> is tier 100 and reserved: a
            person who looked outranks every plugin.
          </FinePrint>
        </DetailCard>
      )}
      {declares.rawStates.length > 0 && (
        <DetailCard title="Registry mapping">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Raw</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 font-medium">Existing copy</th>
              </tr>
            </thead>
            <tbody>
              {declares.rawStates.map((state) => (
                <tr key={state.raw} className="border-t">
                  <td className="py-1.5 font-mono text-xs">{state.raw}</td>
                  <td className="py-1.5">
                    {state.state ?? <span className="text-tone-amber-foreground">Unmapped</span>}
                  </td>
                  <td className="py-1.5">
                    {state.isExistingCopy ? (
                      <span className="text-tone-purple-foreground">counts</span>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasUnmapped && (
            <StatusNote tone="amber" title="Unmapped on purpose" className="mt-3">
              An unmapped value shown verbatim costs a curator one moment of unfamiliarity; a wrong
              mapping tells every curator something false, silently.
            </StatusNote>
          )}
        </DetailCard>
      )}
      {declares.agent !== null && (
        <DetailCard title="Agent">
          <FactGrid
            facts={[
              { label: "Name", value: declares.agent.name },
              { label: "Entry point", value: entryPointText(declares.agent.entryPoint) },
            ]}
          />
          <FinePrint>
            {declares.agent.entryPoint === "proposals"
              ? "What it finds goes through review, attributed to the agent."
              : "What it finds skips review: created already approved, attributed to the agent."}
          </FinePrint>
        </DetailCard>
      )}
      {declares.rules.length > 0 && (
        <DetailCard title="Rules">
          {declares.rules.map((rule) => (
            <DetailRow key={rule.code}>
              <span className="font-mono">{rule.code}</span> {rule.label}
            </DetailRow>
          ))}
          <FinePrint>
            A rule code stays stable between versions: renumbering one would silently invalidate
            every approval made against it.
          </FinePrint>
        </DetailCard>
      )}
      <DetailCard title="What it declares">
        <FactGrid facts={declaredFacts(version)} />
      </DetailCard>
    </>
  );
}

function declaredFacts(version: PluginVersion): Fact[] {
  const { declares } = version;
  return [
    ...(declares.identifierTypes.length > 0
      ? [{ label: "Identifiers it resolves", value: declares.identifierTypes.join(" · ") }]
      : []),
    ...(declares.generatorClass === null
      ? []
      : [
          {
            label: "Class",
            value:
              declares.generatorClass === "AiBased"
                ? `${generatorClassText(declares.generatorClass)}: gives its own reason for every pick; not deterministic`
                : `${generatorClassText(declares.generatorClass)}: the same pool gives the same list`,
          },
        ]),
    ...(declares.channelInterface === null
      ? []
      : [{ label: "Interface", value: declares.channelInterface.toLowerCase() }]),
    ...(declares.inputMode === null
      ? []
      : [{ label: "Way in", value: declares.inputMode.toLowerCase() }]),
    {
      label: "Runs",
      value: version.triggers.map((trigger) => triggerLabels[trigger]).join(", "),
    },
    {
      label: "Configured with",
      value:
        version.configFields.length === 0
          ? "nothing"
          : version.configFields
              .map(
                (field) =>
                  `${field.key}${field.isSecret ? " (secret)" : ""}${field.isRequired ? "" : " (optional)"}`,
              )
              .join(", "),
    },
    { label: "Contract", value: version.contractVersion },
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
    <div className="grid gap-4 text-[0.8125rem]">
      {notice}
      {!instance.isEnabled && (
        <StatusNote tone="slate" title="Disabled">
          It keeps its configuration and runs nowhere.
        </StatusNote>
      )}

      <DetailCard title="Configuration">
        <pre className="mb-3 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap">
          {configuration.length === 0
            ? "—"
            : configuration.map(([key, value]) => `${key} = ${value}`).join("\n")}
        </pre>
        <FactGrid
          facts={[
            {
              label: "Linked to",
              value:
                instance.linkedCategoryId === null
                  ? "all categories"
                  : names.categoryOf(instance.linkedCategoryId),
            },
            {
              label: "Created",
              value: `${formatCalendarDay(instance.createdAt)} · ${names.userOf(instance.createdBy)}`,
            },
          ]}
        />
      </DetailCard>

      {instance.settings !== null && (
        <SettingsCard settings={instance.settings} names={names} reach={reach} />
      )}

      <DetailCard title="When it runs">
        <FactGrid
          facts={[
            ...(instance.triggers.length > 0
              ? [
                  {
                    label: "On",
                    value: instance.triggers.map((trigger) => triggerLabels[trigger]).join(", "),
                  },
                ]
              : []),
            ...instance.schedules.map((schedule) => ({
              label: "Scheduled",
              value: (
                <>
                  {cadenceText(schedule.cadence)}
                  {schedule.isPaused && <Muted> · paused</Muted>}
                  {reach.canSeeTasks && (
                    <>
                      {" · "}
                      <Link
                        to={`/schedules?s=${encodeURIComponent(schedule.id)}`}
                        className={linkClass}
                      >
                        edit on Schedules
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
            No schedule: it runs only{" "}
            {instance.triggers.length === 0 ? "by hand" : runsText(instance)}.
            {reach.canSeeTasks && (
              <>
                {" "}
                <Link to="/schedules" className={linkClass}>
                  Add one on Schedules
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

      <DetailCard title="What it supplies">
        {version === undefined || suppliesOf(version).length === 0 ? (
          <Muted>Nothing it declares beyond doing its job.</Muted>
        ) : (
          <SupplyChips items={suppliesOf(version)} />
        )}
        <FinePrint>
          Declared by the implementation:{" "}
          <button type="button" className={linkClass} onClick={onOpenImplementation}>
            see its contract
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
  const title = `Recent runs${instance.runCount > 0 ? ` · ${instance.runCount}` : ""}`;
  return (
    <DetailCard
      title={title}
      action={
        reach.canSeeTasks && instance.runCount > 0 ? (
          <Link
            to={`/tasks?plugin=${encodeURIComponent(instance.id)}`}
            className={`${linkClass} text-xs`}
          >
            All on Tasks
          </Link>
        ) : undefined
      }
    >
      {instance.recentRuns.length === 0 ? (
        <Muted>
          {instance.lastRunAt === null
            ? "It has not run yet."
            : `Last run ${shortDayOf(instance.lastRunAt)}; its run has expired from Tasks.`}
        </Muted>
      ) : (
        instance.recentRuns.map((run) => (
          <DetailRow key={run.id} aside={<RunStateBadge run={run} />}>
            {reach.canSeeTasks ? (
              <Link to={`/tasks?run=${encodeURIComponent(run.id)}`} className={linkClass}>
                {run.what}
              </Link>
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
        <DetailCard title="Login">
          <FactGrid
            facts={[
              { label: "Button", value: settings.label },
              { label: "Order on the login page", value: settings.order },
              {
                label: "User id claim",
                value: <span className="font-mono">{settings.userIdClaim}</span>,
              },
              {
                label: "A new user gets",
                value:
                  settings.defaultRoleId === null
                    ? "no role: they see “no access yet”"
                    : names.roleOf(settings.defaultRoleId),
              },
              {
                label: "Match by email",
                value: settings.matchByEmail
                  ? "yes: a verified address joins an existing user"
                  : "no",
              },
            ]}
          />
          <h4 className="mt-4 mb-1 text-xs font-medium text-muted-foreground">
            Claims it maps to roles
          </h4>
          {settings.mappings.length === 0 ? (
            <Muted>None: roles are given by hand on Users &amp; Groups.</Muted>
          ) : (
            settings.mappings.map((mapping) => (
              <DetailRow key={mapping.claim} aside={names.roleOf(mapping.roleId)}>
                <span className="font-mono text-xs">{mapping.claim}</span>
              </DetailRow>
            ))
          )}
          <FinePrint>Applied at every login: a role holds while its claim does.</FinePrint>
        </DetailCard>
      );
    case "Custody":
      return (
        <DetailCard title="Custodies it places into">
          {settings.custodyNames.map((name) => {
            const custodyId = names.custodyIdOf(name);
            return (
              <DetailRow key={name}>
                {reach.canSeeAccess && custodyId !== undefined ? (
                  <Link to={`/access?c=${encodeURIComponent(custodyId)}`} className={linkClass}>
                    {name}
                  </Link>
                ) : (
                  <>
                    {name}
                    {custodyId === undefined && (
                      <Muted> · no such custody: what it names lands in the fallback</Muted>
                    )}
                  </>
                )}
              </DetailRow>
            );
          })}
          <FinePrint>What no rule places lands in the fallback custody.</FinePrint>
        </DetailCard>
      );
    case "Message":
    case "Classifier":
      return (
        <DetailCard title="Order">
          <FactGrid facts={[{ label: "Among its kind", value: settings.order }]} />
          <FinePrint>
            {settings.kind === "Message"
              ? "Message… offers the instances in this order."
              : "Asked in this order; the first suggestion wins, and the decide form names who made it."}
          </FinePrint>
        </DetailCard>
      );
  }
}
