// The identifier types the propose settings carry (DOC-identifiers): each enabled Identifier
// instance in its order, a Pattern instance with its recogniser read from its configuration; then
// every type no instance is enabled for, which is read only when chosen and checked with the
// catalog lookup (DOC-lines). And the refusal of a Pattern configuration that does not make one.

import { identifierRules as identifierRulesShared } from "@vera/contract/queries/ways-in";
import type { IdentifierTypeRule } from "@vera/domain/identifiers";
import {
  identifierChecksums,
  identifierTypeSchema,
  identifierTypes,
  normalisationSteps,
} from "@vera/domain/identifiers";
import { database } from "@/mocks/database";
import type { Refusal } from "@/mocks/mutations";
import { implementationOf, liveInstances } from "@/mocks/plugin-instances";

export const patternImplementationName = "Pattern";

const listOf = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");

export function identifierRules(): IdentifierTypeRule[] {
  return identifierRulesShared(database.pluginInstances, database.pluginImplementations);
}

const configurationRefusal = (message: string): Refusal => ({
  status: 422,
  code: "plugin.identifier",
  message,
});

// A Pattern instance names a type, a pattern that compiles, known steps and checksum; and one
// instance per type (DOC-identifiers).
export function patternRefusal(
  configuration: Readonly<Record<string, string>>,
  instanceId: string | null,
): Refusal | null {
  const type = identifierTypeSchema.safeParse(configuration.type);
  if (!type.success) {
    return configurationRefusal(`The type is one of ${identifierTypes.join(", ")}`);
  }

  try {
    new RegExp(configuration.pattern ?? "");
  } catch {
    return configurationRefusal("The pattern is not a regular expression");
  }

  const steps: readonly string[] = normalisationSteps;
  if (listOf(configuration.normalisation).some((step) => !steps.includes(step))) {
    return configurationRefusal(`Normalisation takes ${normalisationSteps.join(", ")}`);
  }

  const checksums: readonly string[] = identifierChecksums;
  const checksum = configuration.checksum ?? "";
  if (checksum !== "" && !checksums.includes(checksum)) {
    return configurationRefusal(`The checksum is one of ${identifierChecksums.join(", ")}`);
  }

  const isTaken = liveInstances().some(
    (instance) =>
      instance.id !== instanceId &&
      implementationOf(instance)?.kind === "Identifier" &&
      instance.configuration.type === type.data,
  );
  return isTaken
    ? {
        status: 409,
        code: "plugin.identifier_taken",
        message: "Another instance recognises that type",
      }
    : null;
}
