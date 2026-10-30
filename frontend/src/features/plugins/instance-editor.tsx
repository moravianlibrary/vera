// *New instance* and *Edit configuration…* (docs/demos/shared/page-plugins.js `editInst`;
// plugins.md §2.2): its name, a field for each key the version is configured with, and what it
// serves. A secret is never shown: blank keeps it, and a new instance must be given one. VERA's
// settings on it sit beside the configuration: an identity's login button, its order, the role a
// new user gets, *match by email* and the claims it maps to roles (one per line, "claim → role");
// a message's or a classifier's order. The user id claim is set when the instance is made and
// shown after. A custody rule's custody, picked from those on Users & Groups and bound to it by
// id (ACCESS-custody-by-plugins); its condition is its configuration. Its policy, from its version's declarations as defaults (PLG-upgrade): the tier of
// each property it supplies, which registry states count as an existing copy
// (REG-copy-not-gate), and a harvester's agent. When it runs by itself is set on Schedules, once
// it exists.

import type {
  InstanceDraft,
  InstanceSettings,
  PluginImplementation,
  PluginInstanceDetail,
  PluginVersion,
} from "@vera/contract/plugins";
import type { EntryPoint, InstancePolicy } from "@vera/domain/plugins";
import {
  defaultPolicyOf,
  entryPoints,
  isRunnableContract,
  maxPluginTier,
} from "@vera/domain/plugins";
import { schedulableKinds } from "@vera/domain/schedules";
import { useId } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { createPluginInstance, savePluginInstance } from "@/api/plugins";
import { categoryLabelOf, Field } from "@/components/classification-fields";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PluginNotice } from "@/features/plugins/plugin-acts";
import { entryPointText } from "@/features/plugins/plugin-words";
import { pluginInvalidations } from "@/features/plugins/use-plugins-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import {
  useCategoriesQuery,
  useRequestCustodiesQuery,
  useRolesQuery,
} from "@/hooks/use-reference-query";

const allCategories = "all";
const noRole = "none";
const mappingArrow = "→";

// A role by its name, as reference data lists them.
interface NamedRole {
  readonly id: string;
  readonly name: string;
}

interface InstanceForm {
  name: string;
  configuration: Record<string, string>;
  linkedCategoryId: string;
  label: string;
  order: string;
  userIdClaim: string;
  defaultRoleId: string;
  matchByEmail: boolean;
  mappings: string;
  // A custody rule's custody; empty until one is picked.
  custodyId: string;
  // PLG-upgrade: by property key.
  tiers: Record<string, string>;
  copyStates: string[];
  agentName: string;
  agentEntryPoint: EntryPoint;
}

export function refusalTextsFor(t: (key: string) => string) {
  return {
    "plugin.name_taken": t("instanceEditor.refusalNameTaken"),
    "plugin.config_missing": t("instanceEditor.refusalConfigMissing"),
    "plugin.user_claim_fixed": t("instanceEditor.refusalClaimFixed"),
    "plugin.last_identity": t("instanceEditor.refusalLastIdentity"),
    "plugin.contract": t("pluginsPage.refusalContract"),
    "plugin.policy": t("instanceEditor.refusalPolicy"),
    "plugin.no_such_custody": t("instanceEditor.refusalCustody"),
    "plugin.identifier": t("instanceEditor.refusalIdentifier"),
    "plugin.identifier_taken": t("instanceEditor.refusalIdentifierTaken"),
    403: t("instanceEditor.refusalForbidden"),
  };
}

// "group mzk-staff → staff", one a line, the role by its name.
function mappingsOf(text: string, roles: readonly NamedRole[]) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [claim = "", roleName = ""] = line.split(/→|->/).map((part) => part.trim());
      return { claim, roleId: roles.find((role) => role.name === roleName)?.id ?? null, roleName };
    });
}

function formSchemaOf(
  t: (key: string, values?: Record<string, unknown>) => string,
  version: PluginVersion,
  isNew: boolean,
  roles: readonly NamedRole[],
  // A custody rule's choices; null for any other kind.
  custodyIds: ReadonlySet<string> | null,
) {
  return z
    .object({
      name: z.string().trim().min(1, t("instanceEditor.validationName")),
      configuration: z.record(z.string(), z.string()),
      linkedCategoryId: z.string(),
      label: z.string(),
      order: z.string(),
      userIdClaim: z.string(),
      defaultRoleId: z.string(),
      matchByEmail: z.boolean(),
      mappings: z.string(),
      custodyId: z.string(),
      tiers: z.record(z.string(), z.string()),
      copyStates: z.array(z.string()),
      agentName: z.string(),
      agentEntryPoint: z.enum(entryPoints),
    })
    .superRefine((values, context) => {
      for (const field of version.configFields) {
        const isEmpty = (values.configuration[field.key] ?? "").trim() === "";
        // A secret left blank keeps the one set; a new instance has none to keep.
        const isKept = field.isSecret && !isNew;
        if (field.isRequired && isEmpty && !isKept) {
          context.addIssue({
            code: "custom",
            path: ["configuration", field.key],
            message: t("instanceEditor.validationRequired", { key: field.key }),
          });
        }
      }

      for (const { key } of version.declares.properties) {
        const tier = Number(values.tiers[key]);
        if (!Number.isInteger(tier) || tier < 0 || tier > maxPluginTier) {
          context.addIssue({
            code: "custom",
            path: ["tiers", key],
            message: t("instanceEditor.validationTier", { max: maxPluginTier }),
          });
        }
      }

      if (custodyIds !== null && !custodyIds.has(values.custodyId)) {
        context.addIssue({
          code: "custom",
          path: ["custodyId"],
          message: t("instanceEditor.validationCustody"),
        });
      }

      if (version.declares.agent !== null && values.agentName.trim() === "") {
        context.addIssue({
          code: "custom",
          path: ["agentName"],
          message: t("instanceEditor.validationAgent"),
        });
      }

      const unknown = mappingsOf(values.mappings, roles).find(
        (mapping) => mapping.claim === "" || mapping.roleId === null,
      );
      if (unknown !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["mappings"],
          message: t("instanceEditor.validationMapping", {
            role: unknown.roleName || t("instanceEditor.aRole"),
          }),
        });
      }
    });
}

function settingsOf(
  kind: PluginImplementation["kind"],
  values: InstanceForm,
  roles: readonly NamedRole[],
): InstanceSettings | null {
  const order = Math.max(1, Number.parseInt(values.order, 10) || 1);
  switch (kind) {
    case "Identity":
      return {
        kind,
        label: values.label.trim() || values.name.trim(),
        order,
        userIdClaim: values.userIdClaim.trim(),
        defaultRoleId: values.defaultRoleId === noRole ? null : values.defaultRoleId,
        matchByEmail: values.matchByEmail,
        mappings: mappingsOf(values.mappings, roles).flatMap((mapping) =>
          mapping.roleId === null ? [] : [{ claim: mapping.claim, roleId: mapping.roleId }],
        ),
      };
    case "Custody":
      return { kind, custodyId: values.custodyId };
    case "Message":
    case "Classifier":
    case "Identifier":
      return { kind, order };
    default:
      return null;
  }
}

function policyOf(version: PluginVersion, values: InstanceForm): InstancePolicy {
  return {
    tiers: version.declares.properties.map(({ key }) => ({
      key,
      tier: Number(values.tiers[key]),
    })),
    copyStates: version.declares.rawStates
      .map(({ raw }) => raw)
      .filter((raw) => values.copyStates.includes(raw)),
    agent:
      version.declares.agent === null
        ? null
        : { name: values.agentName.trim(), entryPoint: values.agentEntryPoint },
  };
}

interface InstanceEditorDialogProps {
  onClose: () => void;
  implementation: PluginImplementation;
  // Null for a new one.
  instance: PluginInstanceDetail | null;
  // Instances of its kind, for a new one's place in the order.
  kindCount: number;
  onSaved: (notice: PluginNotice, instanceId: string) => void;
}

export function InstanceEditorDialog({
  onClose,
  implementation,
  instance,
  kindCount,
  onSaved,
}: InstanceEditorDialogProps) {
  const { t } = useTranslation("plugins");
  const id = useId();
  const { data: roles = [] } = useRolesQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const isCustody = implementation.kind === "Custody";
  const { data: custodies = [] } = useRequestCustodiesQuery({ isEnabled: isCustody });
  // ACCESS-fallback: it holds only what no rule placed, so no rule picks it.
  const pickable = custodies.filter((custody) => !custody.isFallback);
  const isNew = instance === null;
  const version =
    implementation.versions.find((candidate) =>
      isNew
        ? isRunnableContract(candidate.contractVersion)
        : candidate.version === instance.version,
    ) ?? implementation.versions[0];
  const save = useActionMutation({
    call: (draft: InstanceDraft) =>
      instance === null
        ? createPluginInstance({ ...draft, implementationId: implementation.id })
        : savePluginInstance(instance.id, draft),
    invalidates: pluginInvalidations,
    refusalTexts: refusalTextsFor(t),
  });
  if (version === undefined) {
    return null;
  }

  const settings = instance?.settings ?? null;
  const identity = settings?.kind === "Identity" ? settings : null;
  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name ?? roleId;
  const isIdentity = implementation.kind === "Identity";
  const hasOrder =
    implementation.kind === "Message" ||
    implementation.kind === "Classifier" ||
    implementation.kind === "Identifier" ||
    implementation.kind === "Identity";
  const configured = new Map(Object.entries(instance?.configuration ?? {}));
  const policy = instance?.policy ?? defaultPolicyOf(version.declares);
  const { declares } = version;

  return (
    <FormDialog<InstanceForm>
      isOpen
      onClose={onClose}
      title={
        isNew
          ? t("instanceEditor.newInstanceTitle", { name: implementation.name })
          : t("instanceEditor.editTitle", { name: instance.name })
      }
      description={t("instanceEditor.description", { name: implementation.name })}
      schema={formSchemaOf(
        t,
        version,
        isNew,
        roles,
        isCustody ? new Set(pickable.map((custody) => custody.id)) : null,
      )}
      defaultValues={{
        name: instance?.name ?? "",
        configuration: Object.fromEntries(
          version.configFields.map((field) => [field.key, configured.get(field.key) ?? ""]),
        ),
        linkedCategoryId: instance?.linkedCategoryId ?? allCategories,
        label: identity?.label ?? "",
        order: String(
          settings !== null && "order" in settings ? settings.order : Math.max(1, kindCount + 1),
        ),
        userIdClaim: identity?.userIdClaim ?? "sub",
        defaultRoleId: identity?.defaultRoleId ?? noRole,
        matchByEmail: identity?.matchByEmail ?? false,
        mappings: (identity?.mappings ?? [])
          .map((mapping) => `${mapping.claim} ${mappingArrow} ${roleName(mapping.roleId)}`)
          .join("\n"),
        // ACCESS-custody-delete: a deleted custody's rule waits for another to be picked.
        custodyId:
          settings?.kind === "Custody" &&
          pickable.some((custody) => custody.id === settings.custodyId)
            ? settings.custodyId
            : "",
        tiers: Object.fromEntries(policy.tiers.map(({ key, tier }) => [key, String(tier)])),
        copyStates: [...policy.copyStates],
        agentName: policy.agent?.name ?? "",
        agentEntryPoint: policy.agent?.entryPoint ?? "proposals",
      }}
      submitLabel={isNew ? t("instanceEditor.createInstance") : t("instanceEditor.save")}
      fieldOf={(refusal) => (refusal.code === "plugin.name_taken" ? "name" : null)}
      onSubmit={async (values) => {
        const secrets = new Set(
          version.configFields.filter((field) => field.isSecret).map((field) => field.key),
        );
        const result = await save.run({
          name: values.name,
          // A secret left blank is not sent, so it keeps its value.
          configuration: Object.fromEntries(
            Object.entries(values.configuration).filter(
              ([key, value]) => !(secrets.has(key) && value.trim() === ""),
            ),
          ),
          linkedCategoryId:
            values.linkedCategoryId === allCategories ? null : values.linkedCategoryId,
          settings: settingsOf(implementation.kind, values, roles),
          policy: policyOf(version, values),
        });
        if (result.isDone) {
          onSaved(
            isNew
              ? {
                  title: t("instanceEditor.createdTitle", { name: result.value.name }),
                  text: t("instanceEditor.createdText"),
                  tone: "green",
                }
              : {
                  title: t("instanceEditor.savedTitle", { name: result.value.name }),
                  text: t("instanceEditor.savedText"),
                  tone: "green",
                },
            result.value.id,
          );
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label={t("instanceEditor.name")}>
            <Input
              id={`${id}-name`}
              placeholder={t("instanceEditor.namePlaceholder")}
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />

          {version.configFields.length > 0 && (
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("instanceEditor.configuration")}
              </legend>
              {version.configFields.map((field) => {
                const isSet = instance?.secretsSet.includes(field.key) === true;
                return (
                  <div key={field.key} className="grid gap-1">
                    <Field
                      id={`${id}-config-${field.key}`}
                      label={field.key}
                      hint={field.isRequired ? undefined : t("instanceEditor.optional")}
                    >
                      <Input
                        id={`${id}-config-${field.key}`}
                        className="font-mono text-xs"
                        type={field.isSecret ? "password" : "text"}
                        autoComplete="off"
                        placeholder={
                          field.isSecret && isSet
                            ? t("instanceEditor.secretPlaceholder")
                            : undefined
                        }
                        {...form.register(`configuration.${field.key}`)}
                      />
                    </Field>
                    <FieldError
                      message={form.formState.errors.configuration?.[field.key]?.message}
                    />
                  </div>
                );
              })}
            </fieldset>
          )}

          <Field id={`${id}-linked`} label={t("instanceEditor.linkedTo")}>
            <Controller
              control={form.control}
              name="linkedCategoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${id}-linked`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allCategories}>
                      {t("instanceEditor.allCategories")}
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {categoryLabelOf(categories, category.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {isIdentity && (
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("instanceEditor.login")}
              </legend>
              <Field id={`${id}-label`} label={t("instanceEditor.buttonOnLoginPage")}>
                <Input
                  id={`${id}-label`}
                  placeholder={t("instanceEditor.loginButtonPlaceholder")}
                  {...form.register("label")}
                />
              </Field>
              <Field
                id={`${id}-claim`}
                label={t("instanceEditor.userIdClaim")}
                hint={isNew ? t("instanceEditor.claimFixed") : undefined}
              >
                {isNew ? (
                  <Input
                    id={`${id}-claim`}
                    className="font-mono text-xs"
                    {...form.register("userIdClaim")}
                  />
                ) : (
                  <p id={`${id}-claim`} className="font-mono text-xs">
                    {identity?.userIdClaim}{" "}
                    <span className="font-sans text-muted-foreground">
                      · {t("instanceEditor.claimFixedText")}
                    </span>
                  </p>
                )}
              </Field>
              <Field id={`${id}-role`} label={t("instanceEditor.defaultRole")}>
                <Controller
                  control={form.control}
                  name="defaultRoleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`${id}-role`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={noRole}>{t("instanceEditor.noRole")}</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Controller
                control={form.control}
                name="matchByEmail"
                render={({ field }) => (
                  <label htmlFor={`${id}-email`} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      id={`${id}-email`}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      className="mt-0.5"
                    />
                    <span>
                      {t("instanceEditor.matchByEmail")}
                      <span className="block text-xs text-muted-foreground">
                        {t("instanceEditor.matchByEmailHint")}
                      </span>
                    </span>
                  </label>
                )}
              />
              <Field
                id={`${id}-mappings`}
                label={t("instanceEditor.claimsToRoles")}
                hint={t("instanceEditor.mappingHint")}
              >
                <Textarea
                  id={`${id}-mappings`}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder={t("instanceEditor.mappingPlaceholder")}
                  {...form.register("mappings")}
                />
              </Field>
              <FieldError message={form.formState.errors.mappings?.message} />
              <p className="text-xs text-muted-foreground">
                {t("instanceEditor.mappingFinePrint")}
              </p>
            </fieldset>
          )}

          {isCustody && (
            <>
              <Field id={`${id}-custody`} label={t("instanceEditor.placesInto")}>
                <Controller
                  control={form.control}
                  name="custodyId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`${id}-custody`} className="w-full">
                        <SelectValue placeholder={t("instanceEditor.pickCustody")} />
                      </SelectTrigger>
                      <SelectContent>
                        {pickable.map((custody) => (
                          <SelectItem key={custody.id} value={custody.id}>
                            {custody.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <FieldError message={form.formState.errors.custodyId?.message} />
              <p className="text-xs text-muted-foreground">
                {t("instanceEditor.custodyFinePrint")}
              </p>
            </>
          )}

          {hasOrder && (
            <Field
              id={`${id}-order`}
              label={isIdentity ? t("instanceEditor.loginPageOrder") : t("instanceEditor.order")}
              hint={
                implementation.kind === "Classifier"
                  ? t("instanceEditor.firstSuggestionWins")
                  : implementation.kind === "Identifier"
                    ? t("instanceEditor.firstIdentifierWins")
                    : undefined
              }
            >
              <Input
                id={`${id}-order`}
                type="number"
                min={1}
                className="w-24"
                {...form.register("order")}
              />
            </Field>
          )}

          {declares.properties.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("instanceEditor.tiersSupplied")}
              </legend>
              {declares.properties.map(({ key, tier }) => (
                <div key={key} className="grid gap-1">
                  <Field
                    id={`${id}-tier-${key}`}
                    label={key}
                    hint={t("instanceEditor.declaredTier", { name: implementation.name, tier })}
                  >
                    <Input
                      id={`${id}-tier-${key}`}
                      type="number"
                      min={0}
                      max={maxPluginTier}
                      className="w-24"
                      {...form.register(`tiers.${key}`)}
                    />
                  </Field>
                  <FieldError message={form.formState.errors.tiers?.[key]?.message} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("instanceEditor.tierFinePrint")}</p>
            </fieldset>
          )}

          {declares.rawStates.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("instanceEditor.countsAsCopy")}
              </legend>
              <Controller
                control={form.control}
                name="copyStates"
                render={({ field }) => (
                  <div className="grid gap-1.5">
                    {declares.rawStates.map((state) => (
                      <label
                        key={state.raw}
                        htmlFor={`${id}-copy-${state.raw}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`${id}-copy-${state.raw}`}
                          checked={field.value.includes(state.raw)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...field.value, state.raw]
                                : field.value.filter((raw) => raw !== state.raw),
                            )
                          }
                        />
                        <span className="font-mono text-xs">{state.raw}</span>
                        <span className="text-xs text-muted-foreground">
                          {state.state ?? t("pluginDrawers.unmapped")}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
              <p className="text-xs text-muted-foreground">{t("instanceEditor.copyFinePrint")}</p>
            </fieldset>
          )}

          {declares.agent !== null && (
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("instanceEditor.agent")}
              </legend>
              <Field
                id={`${id}-agent`}
                label={t("instanceEditor.name")}
                hint={t("instanceEditor.agentHint")}
              >
                <Input id={`${id}-agent`} {...form.register("agentName")} />
              </Field>
              <FieldError message={form.formState.errors.agentName?.message} />
              <Field id={`${id}-entry`} label={t("instanceEditor.whatItFindsEnters")}>
                <Controller
                  control={form.control}
                  name="agentEntryPoint"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`${id}-entry`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {entryPoints.map((entryPoint) => (
                          <SelectItem key={entryPoint} value={entryPoint}>
                            {entryPointText(entryPoint)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </fieldset>
          )}

          {(schedulableKinds as readonly string[]).includes(implementation.kind) && (
            <p className="text-xs text-muted-foreground">{t("instanceEditor.scheduleFinePrint")}</p>
          )}
        </>
      )}
    />
  );
}
