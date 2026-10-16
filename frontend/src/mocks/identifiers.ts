// The identifier types the propose settings carry (DOC-identifiers): each enabled Identifier
// instance in its order, a Pattern instance with its recogniser read from its configuration; then
// every type no instance is enabled for, which is read only when chosen and checked with the
// catalog lookup (DOC-lines). And the refusal of a Pattern configuration that does not make one.

import type {
  IdentifierRecogniser,
  IdentifierType,
  IdentifierTypeRule,
} from "@/domain/identifiers";
import {
  identifierChecksums,
  identifierTypeSchema,
  identifierTypes,
  normalisationSteps,
} from "@/domain/identifiers";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import type { Refusal } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf, liveInstances } from "@/mocks/plugin-instances";

export const patternImplementationName = "Pattern";

// The names of a type no instance names.
const typeLabels: Record<IdentifierType, IdentifierTypeRule["labels"]> = {
  catalogId: { en: "Catalog ID", cs: "Systémové číslo" },
  nbn: { en: "NBN", cs: "ČNB" },
  isbn: { en: "ISBN", cs: "ISBN" },
  issn: { en: "ISSN", cs: "ISSN" },
  barcode: { en: "Barcode", cs: "Čárový kód" },
  shelfMark: { en: "Shelf mark", cs: "Signatura" },
};

const listOf = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");

function isPattern(instance: StoredPluginInstance): boolean {
  return implementationOf(instance)?.name === patternImplementationName;
}

function typeOf(instance: StoredPluginInstance): IdentifierType | null {
  const parsed = identifierTypeSchema.safeParse(instance.configuration.type);
  return parsed.success ? parsed.data : null;
}

function recogniserOf(configuration: Readonly<Record<string, string>>): IdentifierRecogniser {
  const checksum = identifierChecksums.find((each) => each === configuration.checksum);
  return {
    pattern: configuration.pattern ?? "",
    normalisation: normalisationSteps.filter((step) =>
      listOf(configuration.normalisation).includes(step),
    ),
    checksum: checksum ?? null,
  };
}

export function identifierRules(): IdentifierTypeRule[] {
  const named = enabledInstancesOf("Identifier").flatMap((instance): IdentifierTypeRule[] => {
    const type = typeOf(instance);
    if (type === null) {
      return [];
    }

    return [
      {
        type,
        labels: {
          en: instance.configuration.label_en || typeLabels[type].en,
          cs: instance.configuration.label_cs || typeLabels[type].cs,
        },
        // A check plugin code makes is the catalog lookup's to report.
        recogniser: isPattern(instance) ? recogniserOf(instance.configuration) : null,
      },
    ];
  });
  const unnamed = identifierTypes
    .filter((type) => !named.some((rule) => rule.type === type))
    .map((type): IdentifierTypeRule => ({ type, labels: typeLabels[type], recogniser: null }));
  return [...named, ...unnamed];
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
