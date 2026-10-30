// What may be done on Plugins, and the dialog each act opens (docs/demos/shared/page-plugins.js;
// STATUS "Plugins"; plugins.md §2.6; permissions.md §3). The header uploads code
// (`plugin.upload_code`). An implementation makes a new instance (`plugin.configure`) and takes a
// new version. An instance runs now (`plugin.run`, a kind that runs by itself, enabled), has its
// configuration edited, is switched on or off, moves to the newest version VERA can run, and is
// deleted (`plugin.configure`). Disable and Delete first say what stops, as the server counts it;
// Enable says nothing first, since nothing stops. Moving says what the new version adds and
// retires. Uploading reads the package's descriptor before anything is installed, and no instance
// moves with it.

import type {
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
  UploadReading,
} from "@vera/contract/plugins";
import type { Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import { compareVersions, isRunnableContract } from "@vera/domain/plugins";
import { schedulableKinds } from "@vera/domain/schedules";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  deletePluginInstance,
  disablePluginInstance,
  installPluginUpload,
  upgradePluginInstance,
  uploadPluginPackage,
} from "@/api/plugins";
import type { ViewAction } from "@/components/actions/action-bar";
import { Field } from "@/components/classification-fields";
import { FinePrint } from "@/components/detail-card";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import type { DialogStep } from "@/components/dialogs/stepped-dialog";
import { SteppedDialog } from "@/components/dialogs/stepped-dialog";
import { StatusNote } from "@/components/status-note";
import { Input } from "@/components/ui/input";
import { InstanceEditorDialog, refusalTextsFor } from "@/features/plugins/instance-editor";
import { KindBadge } from "@/features/plugins/plugin-table";
import {
  declaredNameText,
  lossText,
  pluginKindLabels,
  suppliesOf,
} from "@/features/plugins/plugin-words";
import {
  pluginInvalidations,
  useInstanceUpgradeQuery,
  usePluginImpactQuery,
} from "@/features/plugins/use-plugins-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { i18n } from "@/i18n";

export interface PluginNotice {
  title: string;
  text: string;
  tone: "green" | "red";
  // The run an act started, followed on Tasks.
  runId?: string;
}

export type PluginDialog =
  | { kind: "newInstance"; implementationId: string }
  | { kind: "edit" | "disable" | "delete" | "upgrade"; instanceId: string }
  // From an implementation, its package must be a version of it.
  | { kind: "upload"; implementationId: string | null };

type Open = (dialog: PluginDialog) => void;

// ---------------------------------------------------------------- the acts

export function headerActionsFor(session: Session, open: Open): ViewAction[] {
  return hasPermission(session, "plugin.upload_code")
    ? [
        {
          id: "upload",
          label: i18n.t("plugins:pluginActs.uploadCode"),
          isPrimary: true,
          onSelect: () => open({ kind: "upload", implementationId: null }),
        },
      ]
    : [];
}

export function implementationActionsFor(
  session: Session,
  implementation: PluginImplementation,
  open: Open,
): ViewAction[] {
  const canRun = implementation.versions.some((version) =>
    isRunnableContract(version.contractVersion),
  );
  return [
    ...(hasPermission(session, "plugin.configure") && canRun
      ? [
          {
            id: "new-instance",
            label: i18n.t("plugins:pluginActs.newInstance"),
            isPrimary: true,
            onSelect: () => open({ kind: "newInstance", implementationId: implementation.id }),
          },
        ]
      : []),
    ...(hasPermission(session, "plugin.upload_code")
      ? [
          {
            id: "upload",
            label: i18n.t("plugins:pluginActs.uploadVersion"),
            onSelect: () => open({ kind: "upload", implementationId: implementation.id }),
          },
        ]
      : []),
  ];
}

// The newest version VERA can run, when the instance runs an older one.
export function newerVersionOf(
  instance: PluginInstanceDetail,
  implementation: PluginImplementation,
): string | null {
  const newest = implementation.versions.find((version) =>
    isRunnableContract(version.contractVersion),
  );
  return newest !== undefined && compareVersions(newest.version, instance.version) > 0
    ? newest.version
    : null;
}

export function instanceActionsFor(
  session: Session,
  instance: PluginInstanceDetail,
  implementation: PluginImplementation,
  { open, onRun, onEnable }: { open: Open; onRun: () => void; onEnable: () => void },
): ViewAction[] {
  const isRunnable = (schedulableKinds as readonly string[]).includes(instance.kind);
  const canConfigure = hasPermission(session, "plugin.configure");
  const newer = newerVersionOf(instance, implementation);
  const act = (kind: "edit" | "disable" | "delete" | "upgrade") => () =>
    open({ kind, instanceId: instance.id });
  return [
    ...(isRunnable && instance.isEnabled && hasPermission(session, "plugin.run")
      ? [
          {
            id: "run",
            label: i18n.t("plugins:pluginActs.runNow"),
            isPrimary: true,
            onSelect: onRun,
          },
        ]
      : []),
    ...(canConfigure
      ? [
          {
            id: "edit",
            label: i18n.t("plugins:pluginActs.editConfiguration"),
            onSelect: act("edit"),
          },
          instance.isEnabled
            ? {
                id: "disable",
                label: i18n.t("plugins:pluginActs.disable"),
                onSelect: act("disable"),
              }
            : { id: "enable", label: i18n.t("plugins:pluginActs.enable"), onSelect: onEnable },
          ...(newer === null
            ? []
            : [
                {
                  id: "upgrade",
                  label: i18n.t("plugins:pluginActs.moveTo", { version: newer }),
                  onSelect: act("upgrade"),
                },
              ]),
          // DOC-identifiers: a predefined instance is edited, never deleted.
          ...(instance.isPredefined
            ? []
            : [
                {
                  id: "delete",
                  label: i18n.t("plugins:pluginActs.delete"),
                  isDestructive: true,
                  onSelect: act("delete"),
                },
              ]),
        ]
      : []),
  ];
}

// ---------------------------------------------------------------- the dialogs

interface PluginDialogViewProps {
  dialog: PluginDialog;
  index: PluginIndex;
  onClose: () => void;
  // What was done, and the record to open after: an instance, an implementation, or none.
  onDone: (notice: PluginNotice, open?: { instanceId?: string; implementationId?: string }) => void;
}

export function PluginDialogView({ dialog, index, onClose, onDone }: PluginDialogViewProps) {
  const instance =
    "instanceId" in dialog
      ? index.instances.find((candidate) => candidate.id === dialog.instanceId)
      : undefined;
  const implementationId =
    "instanceId" in dialog ? instance?.implementationId : dialog.implementationId;
  const implementation = index.implementations.find(
    (candidate) => candidate.id === implementationId,
  );

  switch (dialog.kind) {
    case "upload":
      return (
        <UploadDialog
          onClose={onClose}
          implementation={implementation ?? null}
          onInstalled={(notice, installedId) => onDone(notice, { implementationId: installedId })}
        />
      );
    case "newInstance":
      return implementation === undefined ? null : (
        <InstanceEditorDialog
          onClose={onClose}
          implementation={implementation}
          instance={null}
          kindCount={index.instances.filter((other) => other.kind === implementation.kind).length}
          onSaved={(notice, instanceId) => onDone(notice, { instanceId })}
        />
      );
    case "edit":
      return instance === undefined || implementation === undefined ? null : (
        <InstanceEditorDialog
          onClose={onClose}
          implementation={implementation}
          instance={instance}
          kindCount={0}
          onSaved={(notice, instanceId) => onDone(notice, { instanceId })}
        />
      );
    case "disable":
      return instance === undefined ? null : (
        <SwitchOffDialog
          onClose={onClose}
          instance={instance}
          isDeleting={false}
          onDone={(notice) => onDone(notice, { instanceId: instance.id })}
        />
      );
    case "delete":
      return instance === undefined ? null : (
        <SwitchOffDialog
          onClose={onClose}
          instance={instance}
          isDeleting
          onDone={(notice) => onDone(notice, { implementationId: instance.implementationId })}
        />
      );
    case "upgrade":
      return instance === undefined ? null : (
        <UpgradeDialog
          onClose={onClose}
          instance={instance}
          onDone={(notice) => onDone(notice, { instanceId: instance.id })}
        />
      );
  }
}

// Disable… and Delete…: what stops, from the server's count, then what stays.
function SwitchOffDialog({
  onClose,
  instance,
  isDeleting,
  onDone,
}: {
  onClose: () => void;
  instance: PluginInstanceDetail;
  isDeleting: boolean;
  onDone: (notice: PluginNotice) => void;
}) {
  const { t } = useTranslation("plugins");
  const { data: impact } = usePluginImpactQuery(instance.id, true);
  const act = useActionMutation({
    call: async (instanceId: string): Promise<null> => {
      await (isDeleting ? deletePluginInstance(instanceId) : disablePluginInstance(instanceId));
      return null;
    },
    invalidates: pluginInvalidations,
    refusalTexts: refusalTextsFor(t),
  });
  const loss = impact === undefined ? undefined : lossText(impact, instance.name);
  const consequences: Consequence[] | undefined =
    impact === undefined || loss === undefined
      ? undefined
      : isDeleting
        ? [
            { text: t("pluginActs.stopsForGood", { loss }), tone: "red" },
            ...(impact.scheduleCount > 0
              ? [
                  {
                    text: t("pluginActs.schedulesDeleted", { count: impact.scheduleCount }),
                    tone: "amber" as const,
                  },
                ]
              : []),
            {
              text:
                impact.runCount > 0
                  ? t("pluginActs.deletedHistory", { count: impact.runCount })
                  : t("pluginActs.deletedHistoryNone"),
            },
          ]
        : [
            { text: t("pluginActs.disabledConsequence", { loss }), tone: "amber" },
            {
              text:
                impact.scheduleCount > 0
                  ? t("pluginActs.disabledWithSchedules")
                  : t("pluginActs.disabledWithoutSchedules"),
            },
          ];
  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={t(isDeleting ? "pluginActs.deleteTitle" : "pluginActs.disableTitle", {
        name: instance.name,
      })}
      description={t(
        isDeleting ? "pluginActs.deleteDescription" : "pluginActs.disableDescription",
        { name: instance.name },
      )}
      consequences={consequences}
      confirmLabel={t(isDeleting ? "pluginActs.deleteInstance" : "pluginActs.disable")}
      isDestructive={isDeleting}
      onConfirm={async () => {
        const result = await act.run(instance.id);
        if (result.isDone) {
          onDone({
            title: t(isDeleting ? "pluginActs.deletedTitle" : "pluginActs.disabledTitle", {
              name: instance.name,
            }),
            text: isDeleting
              ? t("pluginActs.runsStay")
              : `${(loss ?? "").charAt(0).toUpperCase()}${(loss ?? "").slice(1)}`,
            tone: "green",
          });
        }

        return result;
      }}
    />
  );
}

// Move to vX…: what the newer version adds and retires, from the server.
function UpgradeDialog({
  onClose,
  instance,
  onDone,
}: {
  onClose: () => void;
  instance: PluginInstanceDetail;
  onDone: (notice: PluginNotice) => void;
}) {
  const { t } = useTranslation("plugins");
  const { data: upgrade } = useInstanceUpgradeQuery(instance.id, true);
  const move = useActionMutation({
    call: upgradePluginInstance,
    invalidates: pluginInvalidations,
    refusalTexts: { ...refusalTextsFor(t), "plugin.up_to_date": t("pluginActs.upToDate") },
  });
  const consequences: Consequence[] | undefined =
    upgrade === undefined
      ? undefined
      : [
          {
            text: t("pluginActs.moveVersion", { from: upgrade.fromVersion, to: upgrade.toVersion }),
          },
          ...upgrade.difference.retired.map(
            (name): Consequence => ({
              text:
                name.kind === "rule"
                  ? upgrade.coveredApprovalCount > 0
                    ? t("pluginActs.retireRule", {
                        name: declaredNameText(name),
                        count: upgrade.coveredApprovalCount,
                      })
                    : t("pluginActs.retireRuleNone", { name: declaredNameText(name) })
                  : t("pluginActs.retireName", { name: declaredNameText(name) }),
              tone: "red",
            }),
          ),
          ...upgrade.difference.added.map(
            (name): Consequence => ({
              text: t("pluginActs.addName", { name: declaredNameText(name) }),
            }),
          ),
          ...upgrade.difference.configDropped.map(
            (key): Consequence => ({
              text: t("pluginActs.dropField", { key }),
              tone: "amber",
            }),
          ),
          ...upgrade.difference.configAdded.map(
            (key): Consequence => ({
              text: t("pluginActs.addField", { key }),
              tone: "amber",
            }),
          ),
        ];
  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={t("pluginActs.moveTitle", { name: instance.name, version: upgrade?.toVersion ?? "…" })}
      description={t("pluginActs.moveDescription", { name: instance.name })}
      consequences={consequences}
      confirmLabel={
        upgrade === undefined
          ? t("pluginActs.move")
          : t("pluginActs.moveTo", { version: upgrade.toVersion })
      }
      isDestructive={false}
      onConfirm={async () => {
        const result = await move.run(instance.id);
        if (result.isDone) {
          onDone({
            title: t("pluginActs.runsVersion", {
              name: instance.name,
              version: result.value.version,
            }),
            text: t("pluginActs.fromNextRun"),
            tone: "green",
          });
        }

        return result;
      }}
    />
  );
}

// ---------------------------------------------------------------- uploading

interface UploadState {
  file: File | null;
  reading: UploadReading | null;
  installed: PluginImplementation | null;
}

const emptyUpload: UploadState = { file: null, reading: null, installed: null };

function uploadRefusalTextsFor(t: (key: string) => string) {
  return {
    "plugin.not_a_package": t("pluginActs.refusalPackage"),
    "plugin.no_descriptor": t("pluginActs.refusalDescriptor"),
    "plugin.version_installed": t("pluginActs.refusalInstalled"),
    "plugin.other_implementation": t("pluginActs.refusalImplementation"),
    403: t("pluginActs.refusalUploadForbidden"),
  };
}

function UploadDialog({
  onClose,
  implementation,
  onInstalled,
}: {
  onClose: () => void;
  implementation: PluginImplementation | null;
  onInstalled: (notice: PluginNotice, implementationId: string) => void;
}) {
  const { t } = useTranslation("plugins");
  const id = useId();
  const read = useActionMutation({
    call: (file: File) => uploadPluginPackage(file, implementation?.id ?? null),
    invalidates: [],
    refusalTexts: uploadRefusalTextsFor(t),
  });
  const install = useActionMutation({
    call: installPluginUpload,
    invalidates: pluginInvalidations,
    refusalTexts: uploadRefusalTextsFor(t),
  });
  const steps: DialogStep<UploadState>[] = [
    {
      label: t("pluginActs.package"),
      advanceLabel: t("pluginActs.readIt"),
      canAdvance: (state) => state.file !== null,
      render: (state, setState) => (
        <div className="grid gap-3">
          <Field id={`${id}-file`} label={t("pluginActs.package")}>
            <Input
              id={`${id}-file`}
              type="file"
              accept=".jar"
              onChange={(event) =>
                setState({ ...emptyUpload, file: event.target.files?.[0] ?? null })
              }
            />
          </Field>
          <FinePrint>
            {implementation === null
              ? t("pluginActs.packageFinePrint")
              : t("pluginActs.versionFinePrint", { version: implementation.versions[0]?.version })}
          </FinePrint>
          {state.file !== null && (
            <p className="text-xs text-muted-foreground">{state.file.name}</p>
          )}
        </div>
      ),
      onAdvance: async (state) => {
        if (state.file === null) {
          return { isDone: true, value: state };
        }

        const result = await read.run(state.file);
        return result.isDone
          ? { isDone: true, value: { ...state, reading: result.value } }
          : result;
      },
    },
    {
      label: t("pluginActs.whatItDeclares"),
      canAdvance: (state) => state.reading !== null,
      render: (state) => (state.reading === null ? null : <ReadingView reading={state.reading} />),
    },
  ];
  return (
    <SteppedDialog<UploadState>
      isOpen
      onClose={onClose}
      title={
        implementation === null
          ? t("pluginActs.uploadCode")
          : t("pluginActs.newVersionTitle", { name: implementation.name })
      }
      description={t("pluginActs.uploadDescription")}
      steps={steps}
      initialState={emptyUpload}
      isDirty={(state) => state.file !== null}
      submitLabel={(state) =>
        state.reading === null
          ? t("pluginActs.install")
          : t("pluginActs.installVersion", { version: state.reading.version.version })
      }
      onSubmit={async (state) => {
        if (state.reading === null) {
          return { isDone: true, value: state };
        }

        const result = await install.run(state.reading.id);
        if (!result.isDone) {
          return result;
        }

        onInstalled(
          {
            title: t("pluginActs.installedTitle", {
              name: result.value.name,
              version: state.reading.version.version,
            }),
            text:
              state.reading.implementationId === null
                ? t("pluginActs.noInstanceUntilMade")
                : t("pluginActs.instancesStayVersion"),
            tone: "green",
          },
          result.value.id,
        );
        return { isDone: true, value: { ...state, installed: result.value } };
      }}
    />
  );
}

function ReadingView({ reading }: { reading: UploadReading }) {
  const { t } = useTranslation("plugins");
  const { difference } = reading;
  const supplies = suppliesOf({ ...reading.version, installedAt: "", installedBy: "" });
  return (
    <div className="grid gap-3 text-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{reading.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            v{reading.version.version}
          </span>
          <KindBadge kind={reading.kind} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{reading.description}</p>
      </div>
      {!reading.isRunnable && (
        <StatusNote
          tone="amber"
          title={t("pluginActs.builtForContract", { version: reading.version.contractVersion })}
        >
          {t("pluginActs.unrunnableContract")}
        </StatusNote>
      )}
      <p>
        {reading.implementationId === null
          ? t("pluginActs.newKind", { kind: t(pluginKindLabels[reading.kind]).toLowerCase() })
          : t("pluginActs.newVersionSummary", {
              name: reading.name,
              version: reading.currentVersion,
            })}
      </p>
      {difference !== null && (
        <ul className="grid gap-1 text-ui">
          {difference.added.length +
            difference.retired.length +
            difference.configAdded.length +
            difference.configDropped.length ===
            0 && <li className="text-muted-foreground">{t("pluginActs.sameDeclarations")}</li>}
          {difference.retired.map((name) => (
            <li key={`retired-${name.kind}-${name.name}`} className="text-tone-red-foreground">
              {name.kind === "rule"
                ? t("pluginActs.retiredRuleSummary", { name: declaredNameText(name) })
                : t("pluginActs.retireName", { name: declaredNameText(name) })}
            </li>
          ))}
          {difference.added.map((name) => (
            <li key={`added-${name.kind}-${name.name}`}>
              {t("pluginActs.addName", { name: declaredNameText(name) })}
            </li>
          ))}
          {difference.configDropped.map((key) => (
            <li key={`dropped-${key}`} className="text-tone-amber-foreground">
              {t("pluginActs.dropField", { key })}
            </li>
          ))}
          {difference.configAdded.map((key) => (
            <li key={`added-field-${key}`} className="text-tone-amber-foreground">
              {t("pluginActs.addFieldShort", { key })}
            </li>
          ))}
        </ul>
      )}
      {supplies.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("pluginActs.supplies", { items: supplies.join(" · ") })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("pluginActs.configuredWith")}
        {reading.version.configFields.length === 0
          ? t("pluginActs.nothing")
          : reading.version.configFields.map((field) => field.key).join(", ")}
        .
      </p>
    </div>
  );
}
