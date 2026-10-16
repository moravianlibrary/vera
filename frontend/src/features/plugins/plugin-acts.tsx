// What may be done on Plugins, and the dialog each act opens (docs/demos/shared/page-plugins.js;
// STATUS "Plugins"; plugins.md §2.6; permissions.md §3). The header uploads code
// (`plugin.upload_code`). An implementation makes a new instance (`plugin.configure`) and takes a
// new version. An instance runs now (`plugin.run`, a kind that runs by itself, enabled), has its
// configuration edited, is switched on or off, moves to the newest version VERA can run, and is
// deleted (`plugin.configure`). Disable and Delete first say what stops, as the server counts it;
// Enable says nothing first, since nothing stops. Moving says what the new version adds and
// retires. Uploading reads the package's descriptor before anything is installed, and no instance
// moves with it.
// TODO(rrandiak): labels move to i18n.

import { useId } from "react";
import type {
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
  UploadReading,
} from "@/api/plugins";
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
import type { Session } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import { compareVersions, isRunnableContract } from "@/domain/plugins";
import { schedulableKinds } from "@/domain/schedules";
import { InstanceEditorDialog, refusalTexts } from "@/features/plugins/instance-editor";
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
import { plural } from "@/lib/plural";

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
          label: "Upload plugin code…",
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
            label: "New instance…",
            isPrimary: true,
            onSelect: () => open({ kind: "newInstance", implementationId: implementation.id }),
          },
        ]
      : []),
    ...(hasPermission(session, "plugin.upload_code")
      ? [
          {
            id: "upload",
            label: "Upload a new version…",
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
      ? [{ id: "run", label: "Run now", isPrimary: true, onSelect: onRun }]
      : []),
    ...(canConfigure
      ? [
          { id: "edit", label: "Edit configuration…", onSelect: act("edit") },
          instance.isEnabled
            ? { id: "disable", label: "Disable…", onSelect: act("disable") }
            : { id: "enable", label: "Enable", onSelect: onEnable },
          ...(newer === null
            ? []
            : [{ id: "upgrade", label: `Move to v${newer}…`, onSelect: act("upgrade") }]),
          // DOC-identifiers: a predefined instance is edited, never deleted.
          ...(instance.isPredefined
            ? []
            : [{ id: "delete", label: "Delete…", isDestructive: true, onSelect: act("delete") }]),
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
  const { data: impact } = usePluginImpactQuery(instance.id, true);
  const act = useActionMutation({
    call: async (instanceId: string): Promise<null> => {
      await (isDeleting ? deletePluginInstance(instanceId) : disablePluginInstance(instanceId));
      return null;
    },
    invalidates: pluginInvalidations,
    refusalTexts,
  });
  const loss = impact === undefined ? undefined : lossText(impact, instance.name);
  const consequences: Consequence[] | undefined =
    impact === undefined || loss === undefined
      ? undefined
      : isDeleting
        ? [
            { text: `It stops for good: ${loss}`, tone: "red" },
            ...(impact.scheduleCount > 0
              ? [
                  {
                    text: `Its ${plural(impact.scheduleCount, "schedule")} on Schedules ${impact.scheduleCount === 1 ? "goes" : "go"} with it.`,
                    tone: "amber" as const,
                  },
                ]
              : []),
            {
              text: `${impact.runCount > 0 ? `Its ${plural(impact.runCount, "run")} on Tasks stay until retention removes them. ` : ""}What it already wrote stays in each record's history. To stop it for a while, disable it instead.`,
            },
          ]
        : [
            { text: `While it is disabled, ${loss}`, tone: "amber" },
            {
              text: `Its configuration and history stay${impact.scheduleCount > 0 ? ", and its schedules are skipped rather than deleted" : ""}. Enable it again at any time.`,
            },
          ];
  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={`${isDeleting ? "Delete" : "Disable"} ${instance.name}?`}
      description={`What ${isDeleting ? "deleting" : "disabling"} the plugin instance ${instance.name} stops`}
      consequences={consequences}
      confirmLabel={isDeleting ? "Delete instance" : "Disable"}
      isDestructive={isDeleting}
      onConfirm={async () => {
        const result = await act.run(instance.id);
        if (result.isDone) {
          onDone({
            title: `${instance.name} ${isDeleting ? "deleted" : "disabled"}`,
            text: isDeleting
              ? "Its runs stay on Tasks."
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
  const { data: upgrade } = useInstanceUpgradeQuery(instance.id, true);
  const move = useActionMutation({
    call: upgradePluginInstance,
    invalidates: pluginInvalidations,
    refusalTexts: { ...refusalTexts, "plugin.up_to_date": "It runs the newest version already." },
  });
  const consequences: Consequence[] | undefined =
    upgrade === undefined
      ? undefined
      : [
          { text: `It moves from v${upgrade.fromVersion} to v${upgrade.toVersion}.` },
          ...upgrade.difference.retired.map(
            (name): Consequence => ({
              text:
                name.kind === "rule"
                  ? `Retires ${declaredNameText(name)}: defects under it are no longer reported${upgrade.coveredApprovalCount > 0 ? `, so ${plural(upgrade.coveredApprovalCount, "approval")} made against it cover nothing` : ""}.`
                  : `Retires ${declaredNameText(name)}.`,
              tone: "red",
            }),
          ),
          ...upgrade.difference.added.map(
            (name): Consequence => ({ text: `Adds ${declaredNameText(name)}.` }),
          ),
          ...upgrade.difference.configDropped.map(
            (key): Consequence => ({
              text: `Drops the field ${key}, and the value it had.`,
              tone: "amber",
            }),
          ),
          ...upgrade.difference.configAdded.map(
            (key): Consequence => ({
              text: `Adds the field ${key}, empty until it is filled.`,
              tone: "amber",
            }),
          ),
        ];
  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={`Move ${instance.name} to v${upgrade?.toVersion ?? "…"}?`}
      description={`What moving ${instance.name} to a newer version changes`}
      consequences={consequences}
      confirmLabel={upgrade === undefined ? "Move" : `Move to v${upgrade.toVersion}`}
      isDestructive={false}
      onConfirm={async () => {
        const result = await move.run(instance.id);
        if (result.isDone) {
          onDone({
            title: `${instance.name} runs v${result.value.version}`,
            text: "From its next run.",
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

const uploadRefusalTexts = {
  "plugin.not_a_package": "A plugin comes as a .jar package.",
  "plugin.no_descriptor": "VERA found no plugin descriptor in it: is it a VERA plugin?",
  "plugin.version_installed": "That version is installed already.",
  "plugin.other_implementation": "That package is another plugin's.",
  403: "Only those who upload plugin code may.",
};

function UploadDialog({
  onClose,
  implementation,
  onInstalled,
}: {
  onClose: () => void;
  implementation: PluginImplementation | null;
  onInstalled: (notice: PluginNotice, implementationId: string) => void;
}) {
  const id = useId();
  const read = useActionMutation({
    call: (file: File) => uploadPluginPackage(file, implementation?.id ?? null),
    invalidates: [],
    refusalTexts: uploadRefusalTexts,
  });
  const install = useActionMutation({
    call: installPluginUpload,
    invalidates: pluginInvalidations,
    refusalTexts: uploadRefusalTexts,
  });
  const steps: DialogStep<UploadState>[] = [
    {
      label: "Package",
      advanceLabel: "Read it",
      canAdvance: (state) => state.file !== null,
      render: (state, setState) => (
        <div className="grid gap-3">
          <Field id={`${id}-file`} label="Package">
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
              ? "The package declares its type and what it supplies; VERA reads it before anything is installed, and nothing runs until an instance of it is made."
              : `Currently v${implementation.versions[0]?.version}. What the new version declares is compared with it before it is installed; no instance moves with it.`}
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
      label: "What it declares",
      canAdvance: (state) => state.reading !== null,
      render: (state) => (state.reading === null ? null : <ReadingView reading={state.reading} />),
    },
  ];
  return (
    <SteppedDialog<UploadState>
      isOpen
      onClose={onClose}
      title={
        implementation === null ? "Upload plugin code" : `New version of ${implementation.name}`
      }
      description="Upload a plugin package; VERA reads what it declares before installing it"
      steps={steps}
      initialState={emptyUpload}
      isDirty={(state) => state.file !== null}
      submitLabel={(state) =>
        state.reading === null ? "Install" : `Install v${state.reading.version.version}`
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
            title: `${result.value.name} v${state.reading.version.version} installed`,
            text:
              state.reading.implementationId === null
                ? "It does nothing until an instance of it is made."
                : "Its instances stay on the version they run until each is moved.",
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
        <StatusNote tone="amber" title={`Built for contract ${reading.version.contractVersion}`}>
          VERA runs contract 1.x: it can be installed, but no instance of it can be enabled.
        </StatusNote>
      )}
      <p>
        {reading.implementationId === null
          ? `A new ${pluginKindLabels[reading.kind].toLowerCase()}: nothing runs until an instance of it is made.`
          : `A new version of ${reading.name}, now at v${reading.currentVersion}. No instance moves with it: each is moved on its own, after the same comparison.`}
      </p>
      {difference !== null && (
        <ul className="grid gap-1 text-[0.8125rem]">
          {difference.added.length +
            difference.retired.length +
            difference.configAdded.length +
            difference.configDropped.length ===
            0 && <li className="text-muted-foreground">It declares the same names and fields.</li>}
          {difference.retired.map((name) => (
            <li key={`retired-${name.kind}-${name.name}`} className="text-tone-red-foreground">
              Retires {declaredNameText(name)}
              {name.kind === "rule" &&
                ": accepted defects under it are no longer reported, so their approvals have nothing to cover"}
              .
            </li>
          ))}
          {difference.added.map((name) => (
            <li key={`added-${name.kind}-${name.name}`}>Adds {declaredNameText(name)}.</li>
          ))}
          {difference.configDropped.map((key) => (
            <li key={`dropped-${key}`} className="text-tone-amber-foreground">
              Drops the field {key}.
            </li>
          ))}
          {difference.configAdded.map((key) => (
            <li key={`added-field-${key}`} className="text-tone-amber-foreground">
              Adds the field {key}.
            </li>
          ))}
        </ul>
      )}
      {supplies.length > 0 && (
        <p className="text-xs text-muted-foreground">Supplies: {supplies.join(" · ")}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Configured with{" "}
        {reading.version.configFields.length === 0
          ? "nothing"
          : reading.version.configFields.map((field) => field.key).join(", ")}
        .
      </p>
    </div>
  );
}
