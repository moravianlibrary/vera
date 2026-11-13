// What the server does for Plugins (plugins.md §1–§2, §2.6; STATUS "Plugins"; permissions.md §3):
// with `plugin.read`, every implementation and every instance not deleted, each instance with its
// configuration less its secrets, its schedules, its runs still kept and its last run. Making,
// editing, switching on and off, moving to a newer version and deleting an instance are
// `plugin.configure`'s; a configuration is checked against the fields its version declares, and
// the last way to log in is never switched off. A changed Custody instance starts a placing run
// (L8). Deleting keeps the instance for its runs and removes its schedules. *Run now* is
// `plugin.run`'s, for a kind that runs by itself (PLG-run-items). Uploading is
// `plugin.upload_code`'s: the package is read, by its file name here, and installed only when
// asked; no instance moves with it.

import type {
  InstanceDraft,
  InstanceSettings,
  InstanceUpgrade,
  NewInstance,
  PluginImpact,
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
  PluginVersion,
  UploadReading,
} from "@vera/contract/plugins";
import { openProposalPlacements } from "@vera/contract/queries/requests";
import type { Run } from "@vera/contract/tasks";
import type { Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import type { InstancePolicy, PluginKind } from "@vera/domain/plugins";
import {
  compareVersions,
  declarationDifferenceOf,
  defaultPolicyOf,
  isRunnableContract,
  pluginKinds,
  policyForVersion,
  policyMismatchOf,
} from "@vera/domain/plugins";
import { schedulableKinds } from "@vera/domain/schedules";
import { database, mockStore } from "@/mocks/database";
import type { StoredPluginImplementation, StoredPluginInstance } from "@/mocks/fixtures/plugins";
import {
  configFieldsOf,
  newPackages,
  nextVersionChanges,
  noDeclarations,
} from "@/mocks/fixtures/plugins";
import { hooksUsingChannel } from "@/mocks/hooks";
import { patternImplementationName, patternRefusal } from "@/mocks/identifiers";
import type { Outcome, Refusal } from "@/mocks/mutations";
import {
  enabledInstancesOf,
  implementationOf,
  kindOf,
  liveInstances,
} from "@/mocks/plugin-instances";
import { mockRequestPlugins } from "@/mocks/requests";
import {
  instanceRunsOf,
  itemCountForInstance,
  publicRunOf,
  startPlacingRun,
  startRun,
} from "@/mocks/tasks";
import { mockNow } from "@/mocks/today";

const recentRunCount = 5;

export function canReadPlugins(session: Session): boolean {
  return hasPermission(session, "plugin.read");
}

// ---------------------------------------------------------------- the page

function versionOf(instance: StoredPluginInstance): PluginVersion | undefined {
  return implementationOf(instance)?.versions.find(
    (version) => version.version === instance.version,
  );
}

// PLG-upgrade: its own, else its version's defaults.
function policyOf(instance: StoredPluginInstance): InstancePolicy {
  const declares = versionOf(instance)?.declares;
  return instance.policy ?? (declares === undefined ? noPolicy : defaultPolicyOf(declares));
}

const noPolicy: InstancePolicy = { tiers: [], copyStates: [], agent: null };

function policyRefusal(version: PluginVersion, policy: InstancePolicy | undefined): Refusal | null {
  const mismatch = policy === undefined ? null : policyMismatchOf(policy, version.declares);
  return mismatch === null ? null : { status: 422, message: mismatch, code: "plugin.policy" };
}

function secretKeysOf(instance: StoredPluginInstance): Set<string> {
  return new Set(
    (versionOf(instance)?.configFields ?? [])
      .filter((field) => field.isSecret)
      .map((field) => field.key),
  );
}

function detailOf(
  instance: StoredPluginInstance,
  now: Date,
  canSeeHooks = true,
): PluginInstanceDetail {
  const secretKeys = secretKeysOf(instance);
  const runs = instanceRunsOf(instance.id, now);
  const lastRunAt = [runs[0]?.startedAt, instance.lastRunAt?.toISOString()]
    .filter((moment): moment is string => moment !== undefined)
    .toSorted()
    .at(-1);
  return {
    id: instance.id,
    name: instance.name,
    implementationId: instance.implementationId,
    kind: kindOf(instance),
    version: instance.version,
    isEnabled: instance.isEnabled,
    configuration: Object.fromEntries(
      Object.entries(instance.configuration).filter(([key]) => !secretKeys.has(key)),
    ),
    secretsSet: [...secretKeys].filter((key) => (instance.configuration[key] ?? "") !== ""),
    linkedCategoryId: instance.linkedCategoryId,
    triggers: [...instance.triggers],
    settings: instance.settings,
    isPredefined: instance.isPredefined === true,
    policy: policyOf(instance),
    createdBy: instance.createdBy,
    createdAt: instance.createdAt,
    schedules: database.schedules
      .filter((schedule) => schedule.instanceId === instance.id)
      .map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        cadence: schedule.cadence,
        isPaused: schedule.pause !== null,
      })),
    hooks: canSeeHooks
      ? hooksUsingChannel(instance.id).map(({ id, name, state }) => ({ id, name, state }))
      : [],
    recentRuns: runs.slice(0, recentRunCount).map((run) => ({
      id: run.id,
      what: run.what,
      state: run.state,
      startedAt: run.startedAt,
      errorCount: run.errorCount,
      changes: run.changes,
    })),
    runCount: runs.length,
    lastRunAt: lastRunAt ?? null,
  };
}

function publicImplementationOf(implementation: StoredPluginImplementation): PluginImplementation {
  return { ...implementation, versions: [...implementation.versions] };
}

export function pluginIndex(session?: Session): PluginIndex {
  const now = mockNow();
  const kindOrder = (kind: PluginKind) => pluginKinds.indexOf(kind);
  return {
    asOf: now.toISOString(),
    implementations: database.pluginImplementations
      .toSorted(
        (first, second) =>
          kindOrder(first.kind) - kindOrder(second.kind) || first.name.localeCompare(second.name),
      )
      .map(publicImplementationOf),
    instances: liveInstances().map((instance) =>
      detailOf(instance, now, session === undefined || hasPermission(session, "hook.read")),
    ),
  };
}

// ---------------------------------------------------------------- shared checks

const mayNotConfigure: Refusal = { status: 403, message: "You may not configure plugins" };
const noSuchInstance: Refusal = { status: 404, message: "No such plugin instance" };

function findLive(instanceId: string): StoredPluginInstance | undefined {
  return liveInstances().find((instance) => instance.id === instanceId);
}

function replaceInstance(instance: StoredPluginInstance): PluginInstanceDetail {
  const index = database.pluginInstances.findIndex((candidate) => candidate.id === instance.id);
  database.pluginInstances.splice(index, 1, instance);
  return detailOf(instance, mockNow());
}

// The kinds whose instances carry VERA's settings.
const settingsKinds = ["Identity", "Custody", "Message", "Classifier", "Identifier"] as const;

function settingsRefusal(
  kind: PluginKind,
  settings: InstanceSettings | null,
  existing: StoredPluginInstance | null,
): Refusal | null {
  const needsSettings = (settingsKinds as readonly string[]).includes(kind);
  if (needsSettings !== (settings !== null) || (settings !== null && settings.kind !== kind)) {
    return {
      status: 422,
      message: `A ${kind} instance takes its own settings`,
      code: "plugin.settings",
    };
  }

  // ACCESS-custody-by-plugins: a rule picks a custody that exists; the fallback holds only what no
  // rule placed (ACCESS-fallback).
  if (settings?.kind === "Custody") {
    const picked = database.requestCustodies.find((custody) => custody.id === settings.custodyId);
    return picked === undefined || picked.isFallback
      ? { status: 422, message: "Pick a request custody", code: "plugin.no_such_custody" }
      : null;
  }

  if (settings?.kind !== "Identity") {
    return null;
  }

  const roleIds = new Set(database.roles.map((role) => role.id));
  const namedRoles = [
    ...(settings.defaultRoleId === null ? [] : [settings.defaultRoleId]),
    ...settings.mappings.map((mapping) => mapping.roleId),
  ];
  if (namedRoles.some((roleId) => !roleIds.has(roleId))) {
    return { status: 422, message: "No such role", code: "plugin.no_such_role" };
  }

  const previous = existing?.settings;
  const hasUsers =
    existing !== null &&
    Object.values(database.userAccess).some((access) =>
      access.identities.some((identity) => identity.instanceId === existing.id),
    );
  if (hasUsers && previous?.kind === "Identity" && previous.userIdClaim !== settings.userIdClaim) {
    return {
      status: 409,
      message: "The user id claim is fixed once people sign in through it",
      code: "plugin.user_claim_fixed",
    };
  }

  return null;
}

// The configuration as stored: secrets left out keep their value, and one sent empty is cleared.
function storedConfigurationOf(
  version: PluginVersion,
  sent: Readonly<Record<string, string>>,
  previous: Readonly<Record<string, string>>,
): Outcome<Record<string, string>> {
  const fieldKeys = new Set(version.configFields.map((field) => field.key));
  const unknown = Object.keys(sent).find((key) => !fieldKeys.has(key));
  if (unknown !== undefined) {
    return {
      refusal: {
        status: 422,
        message: `${unknown} is not a field of this version`,
        code: "plugin.config_unknown",
      },
    };
  }

  const configuration: Record<string, string> = {};
  for (const field of version.configFields) {
    const value = (
      field.isSecret && !(field.key in sent) ? previous[field.key] : sent[field.key]
    )?.trim();
    if (value === undefined || value === "") {
      if (field.isRequired) {
        return {
          refusal: {
            status: 422,
            message: `${field.key} is required`,
            code: "plugin.config_missing",
          },
        };
      }

      continue;
    }

    configuration[field.key] = value;
  }

  return { value: configuration };
}

function draftRefusal(
  implementation: StoredPluginImplementation,
  draft: InstanceDraft,
  existing: StoredPluginInstance | null,
): Refusal | null {
  const name = draft.name.trim();
  const isTaken = liveInstances().some(
    (instance) =>
      instance.id !== existing?.id &&
      instance.implementationId === implementation.id &&
      instance.name.localeCompare(name, "cs", { sensitivity: "base" }) === 0,
  );
  if (isTaken) {
    return {
      status: 409,
      message: "Another instance of it has that name",
      code: "plugin.name_taken",
    };
  }

  const isKnownCategory =
    draft.linkedCategoryId === null ||
    database.categories.some((category) => category.id === draft.linkedCategoryId);
  if (!isKnownCategory) {
    return { status: 422, message: "No such category", code: "plugin.no_such_category" };
  }

  const patternProblem =
    implementation.name === patternImplementationName
      ? patternRefusal(draft.configuration, existing?.id ?? null)
      : null;
  return patternProblem ?? settingsRefusal(implementation.kind, draft.settings, existing);
}

// ---------------------------------------------------------------- an instance

export function createInstance(
  session: Session,
  draft: NewInstance,
): Outcome<PluginInstanceDetail> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const implementation = database.pluginImplementations.find(
    (candidate) => candidate.id === draft.implementationId,
  );
  // A new instance runs the newest version VERA can run.
  const version = implementation?.versions.find((candidate) =>
    isRunnableContract(candidate.contractVersion),
  );
  if (implementation === undefined || version === undefined) {
    return { refusal: { status: 404, message: "No such implementation VERA can run" } };
  }

  const refusal = draftRefusal(implementation, draft, null) ?? policyRefusal(version, draft.policy);
  if (refusal !== null) {
    return { refusal };
  }

  const configuration = storedConfigurationOf(version, draft.configuration, {});
  if ("refusal" in configuration) {
    return configuration;
  }

  const highest = Math.max(
    0,
    ...database.pluginInstances.map((instance) => Number.parseInt(instance.id.slice(2), 10) || 0),
  );
  const instance: StoredPluginInstance = {
    id: `pi${highest + 1}`,
    name: draft.name.trim(),
    implementationId: implementation.id,
    version: version.version,
    isEnabled: true,
    configuration: configuration.value,
    linkedCategoryId: draft.linkedCategoryId,
    // Every trigger it accepts but a schedule, which is made on Schedules.
    triggers: version.triggers.filter((trigger) => trigger !== "OnSchedule"),
    settings: draft.settings,
    ...(draft.policy === undefined ? {} : { policy: draft.policy }),
    createdBy: session.user.id,
    createdAt: calendarDayOf(mockNow()),
    lastRunAt: null,
    isDeleted: false,
  };
  database.pluginInstances.push(instance);
  return { value: detailOf(instance, mockNow()) };
}

// The server saves the configuration and re-places open proposals after a Custody change (L8).
export function saveInstance(
  session: Session,
  instanceId: string,
  draft: InstanceDraft,
): Outcome<PluginInstanceDetail> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const instance = findLive(instanceId);
  const implementation = instance === undefined ? undefined : implementationOf(instance);
  const version = instance === undefined ? undefined : versionOf(instance);
  if (instance === undefined || implementation === undefined || version === undefined) {
    return { refusal: noSuchInstance };
  }

  const refusal =
    draftRefusal(implementation, draft, instance) ?? policyRefusal(version, draft.policy);
  if (refusal !== null) {
    return { refusal };
  }

  const configuration = storedConfigurationOf(version, draft.configuration, instance.configuration);
  if ("refusal" in configuration) {
    return configuration;
  }

  const saved = replaceInstance({
    ...instance,
    name: draft.name.trim(),
    configuration: configuration.value,
    linkedCategoryId: draft.linkedCategoryId,
    settings: draft.settings,
    policy: draft.policy ?? instance.policy,
  });
  if (instance.settings?.kind === "Custody") {
    startPlacingRun(session, { label: "Plugins", path: `/plugins?i=${instanceId}` });
  }
  return { value: saved };
}

// Nobody could log in at all, the administrators included.
function lastWayInRefusal(instance: StoredPluginInstance): Refusal | null {
  const others = enabledInstancesOf("Identity").filter((candidate) => candidate.id !== instance.id);
  return kindOf(instance) === "Identity" && instance.isEnabled && others.length === 0
    ? {
        status: 409,
        message: "It is the last way to log in",
        code: "plugin.last_identity",
      }
    : null;
}

// The server re-places open proposals after a Custody instance changes (PLG-disable, L8).
export function setInstanceEnabled(
  session: Session,
  instanceId: string,
  isEnabled: boolean,
): Outcome<PluginInstanceDetail> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const instance = findLive(instanceId);
  const version = instance === undefined ? undefined : versionOf(instance);
  if (instance === undefined || version === undefined) {
    return { refusal: noSuchInstance };
  }

  if (instance.isEnabled === isEnabled) {
    return {
      refusal: {
        status: 409,
        message: isEnabled ? "It is already enabled" : "It is already disabled",
        code: "plugin.unchanged",
      },
    };
  }

  if (isEnabled && !isRunnableContract(version.contractVersion)) {
    return {
      refusal: {
        status: 409,
        message: "Its version was built for a contract VERA does not run",
        code: "plugin.contract",
      },
    };
  }

  const refusal = isEnabled ? null : lastWayInRefusal(instance);
  if (refusal !== null) {
    return { refusal };
  }

  const updated = replaceInstance({ ...instance, isEnabled });
  if (instance.settings?.kind === "Custody") {
    startPlacingRun(session, { label: "Plugins", path: `/plugins?i=${instanceId}` });
  }
  return { value: updated };
}

export function instanceImpact(session: Session, instanceId: string): Outcome<PluginImpact> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const instance = findLive(instanceId);
  if (instance === undefined) {
    return { refusal: noSuchInstance };
  }

  const kind = kindOf(instance);
  const operations = versionOf(instance)?.declares.operations ?? [];
  const others = enabledInstancesOf(kind).filter(
    (candidate) =>
      candidate.id !== instance.id &&
      (kind !== "Input" ||
        (versionOf(candidate)?.declares.operations ?? []).some((operation) =>
          operations.includes(operation),
        )),
  );
  // PLG-delivery-hooks: what a channel switched off stops.
  const stoppedHooks = hooksUsingChannel(instance.id).filter((hook) => hook.state === "active");
  const custodyIds = new Set(
    instance.settings?.kind === "Custody" ? [instance.settings.custodyId] : [],
  );
  return {
    value: {
      kind,
      otherEnabledCount: others.length,
      scheduleCount: database.schedules.filter((schedule) => schedule.instanceId === instance.id)
        .length,
      runCount: instanceRunsOf(instance.id, mockNow()).length,
      userCount: Object.values(database.userAccess).filter((access) =>
        access.identities.some((identity) => identity.instanceId === instance.id),
      ).length,
      openProposalCount: openProposalPlacements(mockStore(), mockRequestPlugins).filter(
        (placedIn) => placedIn.some((custodyId) => custodyIds.has(custodyId)),
      ).length,
      hookCount: stoppedHooks.length,
      hooks: hasPermission(session, "hook.read")
        ? stoppedHooks.map(({ id, name }) => ({ id, name }))
        : [],
    },
  };
}

// Kept for the runs it made, which stay under retention; its schedules go with it.
// The server removes the instance and re-places open proposals when it was Custody (PLG-delete, L8).
export function deleteInstance(session: Session, instanceId: string): Outcome<null> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const instance = findLive(instanceId);
  if (instance === undefined) {
    return { refusal: noSuchInstance };
  }

  // DOC-identifiers: a predefined instance is edited, never deleted.
  if (instance.isPredefined === true) {
    return {
      refusal: {
        status: 409,
        code: "plugin.predefined",
        message: "A predefined instance is not deleted",
      },
    };
  }

  const refusal = lastWayInRefusal(instance);
  if (refusal !== null) {
    return { refusal };
  }

  replaceInstance({ ...instance, isEnabled: false, isDeleted: true });
  database.schedules = database.schedules.filter((schedule) => schedule.instanceId !== instanceId);
  if (instance.settings?.kind === "Custody") {
    startPlacingRun(session, { label: "Plugins", path: `/plugins?i=${instanceId}` });
  }
  return { value: null };
}

// The server stores a run over this kind's set before its job works it (PLG-run-items).
export function runInstanceNow(session: Session, instanceId: string): Outcome<Run> {
  if (!hasPermission(session, "plugin.run")) {
    return { refusal: { status: 403, message: "You may not run plugins" } };
  }

  const instance = findLive(instanceId);
  if (instance === undefined) {
    return { refusal: noSuchInstance };
  }

  if (!(schedulableKinds as readonly string[]).includes(kindOf(instance))) {
    return {
      refusal: {
        status: 422,
        message: "That plugin runs only while somebody uses it",
        code: "plugin.not_runnable",
      },
    };
  }

  if (!instance.isEnabled) {
    return { refusal: { status: 409, message: "It is disabled", code: "plugin.disabled" } };
  }

  const started = startRun({
    what: `${instance.name} — run by hand`,
    instanceId,
    trigger: { kind: "manual", from: { label: "Plugins", path: `/plugins?i=${instanceId}` } },
    startedBy: session.user.id,
    itemCount: itemCountForInstance(instanceId),
    rerunOf: null,
  });
  return { value: publicRunOf(started, mockNow()) };
}

// ---------------------------------------------------------------- versions

function newestRunnable(implementation: StoredPluginImplementation): PluginVersion | undefined {
  return implementation.versions.find((version) => isRunnableContract(version.contractVersion));
}

// Approvals of defects under the retired rule codes, which then cover nothing.
function coveredApprovalCountOf(implementationId: string, retiredCodes: readonly string[]) {
  const instanceIds = new Set(
    database.pluginInstances
      .filter((instance) => instance.implementationId === implementationId)
      .map((instance) => instance.id),
  );
  const approvedKeys = database.iterations.flatMap((iteration) =>
    iteration.verdicts
      .filter((verdict) => verdict.verdict === "Approved")
      .flatMap((verdict) => verdict.defectKeys)
      .filter((key) =>
        iteration.defects.some(
          (defect) =>
            defect.key === key &&
            instanceIds.has(defect.instanceId) &&
            retiredCodes.includes(defect.ruleCode),
        ),
      ),
  );
  return new Set(approvedKeys).size;
}

export function instanceUpgrade(session: Session, instanceId: string): Outcome<InstanceUpgrade> {
  if (!hasPermission(session, "plugin.configure")) {
    return { refusal: mayNotConfigure };
  }

  const instance = findLive(instanceId);
  const implementation = instance === undefined ? undefined : implementationOf(instance);
  const from = instance === undefined ? undefined : versionOf(instance);
  const to = implementation === undefined ? undefined : newestRunnable(implementation);
  if (instance === undefined || implementation === undefined || from === undefined) {
    return { refusal: noSuchInstance };
  }

  if (to === undefined || compareVersions(to.version, from.version) <= 0) {
    return {
      refusal: {
        status: 409,
        message: "It runs the newest version VERA can run",
        code: "plugin.up_to_date",
      },
    };
  }

  const difference = declarationDifferenceOf(from, to);
  return {
    value: {
      fromVersion: from.version,
      toVersion: to.version,
      difference,
      coveredApprovalCount: coveredApprovalCountOf(
        implementation.id,
        difference.retired.filter((name) => name.kind === "rule").map((name) => name.name),
      ),
    },
  };
}

export function upgradeInstance(
  session: Session,
  instanceId: string,
): Outcome<PluginInstanceDetail> {
  const upgrade = instanceUpgrade(session, instanceId);
  const instance = findLive(instanceId);
  if ("refusal" in upgrade || instance === undefined) {
    return "refusal" in upgrade ? upgrade : { refusal: noSuchInstance };
  }

  // A field the new version dropped goes; one it added is empty until somebody fills it.
  const kept = new Set(
    implementationOf(instance)
      ?.versions.find((version) => version.version === upgrade.value.toVersion)
      ?.configFields.map((field) => field.key),
  );
  const declares = implementationOf(instance)?.versions.find(
    (version) => version.version === upgrade.value.toVersion,
  )?.declares;
  return {
    value: replaceInstance({
      ...instance,
      version: upgrade.value.toVersion,
      // Its own choices carried over; what is new takes the new version's default (PLG-upgrade).
      policy:
        instance.policy === undefined || declares === undefined
          ? undefined
          : policyForVersion(instance.policy, declares),
      configuration: Object.fromEntries(
        Object.entries(instance.configuration).filter(([key]) => kept.has(key)),
      ),
    }),
  };
}

// ---------------------------------------------------------------- uploading

export interface StoredUpload extends UploadReading {
  readonly uploadedBy: string;
}

const packagePattern = /^(?<slug>[a-z0-9-]+?)(?:-(?<version>\d+\.\d+\.\d+))?\.jar$/i;

function slugOf(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function nextMinorOf(version: string): string {
  const [major = "0", minor = "0"] = version.split(".");
  return `${major}.${Number.parseInt(minor, 10) + 1}.0`;
}

const mayNotUpload: Refusal = { status: 403, message: "You may not upload plugin code" };
const noDescriptor: Refusal = {
  status: 422,
  message: "VERA found no plugin descriptor in it",
  code: "plugin.no_descriptor",
};

export function readUpload(
  session: Session,
  fileName: string,
  implementationId: string | null,
): Outcome<UploadReading> {
  if (!hasPermission(session, "plugin.upload_code")) {
    return { refusal: mayNotUpload };
  }

  const match = packagePattern.exec(fileName);
  if (match === null) {
    return {
      refusal: {
        status: 422,
        message: "A plugin comes as a .jar package",
        code: "plugin.not_a_package",
      },
    };
  }

  const slug = (match.groups?.slug ?? "").toLowerCase();
  const named = database.pluginImplementations.find(
    (implementation) => slugOf(implementation.name) === slug,
  );
  const asked =
    implementationId === null
      ? undefined
      : database.pluginImplementations.find((candidate) => candidate.id === implementationId);
  const implementation = asked ?? named;
  if (asked !== undefined && named !== asked && !(slug in newPackages) && named !== undefined) {
    return {
      refusal: {
        status: 422,
        message: `That is a package of ${named.name}, not of ${asked.name}`,
        code: "plugin.other_implementation",
      },
    };
  }

  const reading =
    implementation === undefined
      ? readNewPackage(slug, match.groups?.version)
      : readNextVersion(implementation, match.groups?.version);
  if ("refusal" in reading) {
    return reading;
  }

  const upload: StoredUpload = {
    ...reading.value,
    id: `up${database.pluginUploads.length + 1}`,
    fileName,
    uploadedBy: session.user.id,
  };
  database.pluginUploads.push(upload);
  const { uploadedBy: _uploadedBy, ...publicReading } = upload;
  return { value: publicReading };
}

type Reading = Omit<UploadReading, "id" | "fileName">;

function readNextVersion(
  implementation: StoredPluginImplementation,
  namedVersion: string | undefined,
): Outcome<Reading> {
  const [newest] = implementation.versions;
  if (newest === undefined) {
    return { refusal: noDescriptor };
  }

  const version = namedVersion ?? nextMinorOf(newest.version);
  if (implementation.versions.some((installed) => installed.version === version)) {
    return {
      refusal: {
        status: 409,
        message: `Version ${version} is installed already`,
        code: "plugin.version_installed",
      },
    };
  }

  const change = nextVersionChanges[implementation.id];
  const next = {
    version,
    contractVersion: newest.contractVersion,
    signer: "Moravská zemská knihovna v Brně",
    triggers: [...newest.triggers],
    declares: { ...newest.declares, ...change?.declares },
    configFields:
      change?.fields === undefined ? [...newest.configFields] : configFieldsOf(...change.fields),
  };
  return {
    value: {
      descriptorId: implementation.descriptorId,
      name: implementation.name,
      kind: implementation.kind,
      description: implementation.description,
      version: next,
      implementationId: implementation.id,
      currentVersion: newest.version,
      difference: declarationDifferenceOf(newest, next),
      isRunnable: isRunnableContract(next.contractVersion),
    },
  };
}

function readNewPackage(slug: string, namedVersion: string | undefined): Outcome<Reading> {
  const known = newPackages[slug];
  if (known === undefined) {
    return { refusal: noDescriptor };
  }

  return {
    value: {
      descriptorId: `cz.mzk.vera.${slug}`,
      name: known.name,
      kind: known.kind,
      description: known.description,
      version: {
        version: namedVersion ?? "0.1.0",
        contractVersion: known.contractVersion,
        signer: "Moravská zemská knihovna v Brně",
        triggers: [...known.triggers],
        declares: { ...noDeclarations, ...known.declares },
        configFields: configFieldsOf(...known.fields),
      },
      implementationId: null,
      currentVersion: null,
      difference: null,
      isRunnable: isRunnableContract(known.contractVersion),
    },
  };
}

export function installUpload(session: Session, uploadId: string): Outcome<PluginImplementation> {
  if (!hasPermission(session, "plugin.upload_code")) {
    return { refusal: mayNotUpload };
  }

  const upload = database.pluginUploads.find((candidate) => candidate.id === uploadId);
  if (upload === undefined) {
    return { refusal: { status: 404, message: "No such upload; upload the package again" } };
  }

  database.pluginUploads = database.pluginUploads.filter((candidate) => candidate !== upload);
  const installed: PluginVersion = {
    ...upload.version,
    installedAt: calendarDayOf(mockNow()),
    installedBy: session.user.id,
  };
  const existing = database.pluginImplementations.find(
    (implementation) => implementation.id === upload.implementationId,
  );
  if (existing !== undefined) {
    const implementation: StoredPluginImplementation = {
      ...existing,
      versions: [...existing.versions, installed].toSorted((first, second) =>
        compareVersions(second.version, first.version),
      ),
    };
    database.pluginImplementations.splice(
      database.pluginImplementations.indexOf(existing),
      1,
      implementation,
    );
    return { value: publicImplementationOf(implementation) };
  }

  const highest = Math.max(
    0,
    ...database.pluginImplementations.map((candidate) =>
      Number.parseInt(candidate.id.slice(2), 10),
    ),
  );
  const implementation: StoredPluginImplementation = {
    id: `pt${highest + 1}`,
    descriptorId: upload.descriptorId,
    name: upload.name,
    kind: upload.kind,
    description: upload.description,
    versions: [installed],
  };
  database.pluginImplementations.push(implementation);
  return { value: publicImplementationOf(implementation) };
}

function calendarDayOf(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${moment.getFullYear()}-${month}-${day}`;
}
