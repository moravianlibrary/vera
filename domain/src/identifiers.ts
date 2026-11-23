// The identifier types as the server sends them with the propose settings (DOC-identifiers): each
// type an Identifier plugin instance, in their order, which decides detection (DOC-lines). A
// Pattern instance sends its recogniser, so a value is normalised and checked as it is typed; a
// type checked only by plugin code, or with no instance enabled, has none and is checked with the
// catalog lookup.

import { z } from "zod";

// DOC-identifiers: the types a document is identified by. Each is named, recognised and checked
// by its Identifier plugin instance; the NBN is the type's international name.
export const identifierTypes = [
  "catalogId",
  "nbn",
  "isbn",
  "issn",
  "barcode",
  "shelfMark",
] as const;
export const identifierTypeSchema = z.enum(identifierTypes);
export type IdentifierType = z.infer<typeof identifierTypeSchema>;

// Applied in this order before the pattern is matched.
export const normalisationSteps = ["trim", "upperCase", "dropHyphens"] as const;
export type NormalisationStep = (typeof normalisationSteps)[number];

export const identifierChecksums = ["isbn10", "isbn13", "issn"] as const;
export type IdentifierChecksum = (typeof identifierChecksums)[number];

export const identifierRecogniserSchema = z.object({
  // A regular expression over the whole normalised value.
  pattern: z.string().min(1),
  normalisation: z.array(z.enum(normalisationSteps)),
  checksum: z.enum(identifierChecksums).nullable(),
});
export type IdentifierRecogniser = z.infer<typeof identifierRecogniserSchema>;

export const identifierTypeRuleSchema = z.object({
  type: identifierTypeSchema,
  // The type's name in each UI language: the NBN is ČNB in Czech.
  labels: z.object({ en: z.string().min(1), cs: z.string().min(1) }),
  // Null when only plugin code checks it, or no instance is enabled for it.
  recogniser: identifierRecogniserSchema.nullable(),
});
export type IdentifierTypeRule = z.infer<typeof identifierTypeRuleSchema>;

const stepOf: Record<NormalisationStep, (value: string) => string> = {
  trim: (value) => value.trim(),
  upperCase: (value) => value.toUpperCase(),
  dropHyphens: (value) => value.replaceAll("-", ""),
};

export function normalise(recogniser: IdentifierRecogniser, value: string): string {
  return recogniser.normalisation.reduce((current, step) => stepOf[step](current), value);
}

const digitsOf = (value: string) => value.replaceAll("-", "");

const checksumOf: Record<IdentifierChecksum, (value: string) => boolean> = {
  isbn10: (value) => {
    const characters = digitsOf(value).toUpperCase();
    if (!/^\d{9}[\dX]$/.test(characters)) {
      return false;
    }

    const sum = [...characters].reduce(
      (total, character, index) =>
        total + (character === "X" ? 10 : Number(character)) * (10 - index),
      0,
    );
    return sum % 11 === 0;
  },
  isbn13: (value) => {
    const characters = digitsOf(value);
    if (!/^\d{13}$/.test(characters)) {
      return false;
    }

    const sum = [...characters].reduce(
      (total, character, index) => total + Number(character) * (index % 2 === 0 ? 1 : 3),
      0,
    );
    return sum % 10 === 0;
  },
  issn: (value) => {
    const characters = digitsOf(value).toUpperCase();
    if (!/^\d{7}[\dX]$/.test(characters)) {
      return false;
    }

    const sum = [...characters.slice(0, 7)].reduce(
      (total, character, index) => total + Number(character) * (8 - index),
      0,
    );
    const check = (11 - (sum % 11)) % 11;
    return characters[7] === (check === 10 ? "X" : String(check));
  },
};

// A pattern that does not compile recognises nothing; the server refuses one when it is saved.
function matches(pattern: string, value: string): boolean {
  try {
    return new RegExp(`^(?:${pattern})$`).test(value);
  } catch {
    return false;
  }
}

export function recognises(recogniser: IdentifierRecogniser, value: string): boolean {
  const normalised = normalise(recogniser, value);
  return (
    matches(recogniser.pattern, normalised) &&
    (recogniser.checksum === null || checksumOf[recogniser.checksum](normalised))
  );
}

export function ruleOf(
  rules: readonly IdentifierTypeRule[],
  type: IdentifierType,
): IdentifierTypeRule | undefined {
  return rules.find((rule) => rule.type === type);
}

// Whether the value can be read as the type: by its recogniser, or, with none, any value, which
// the catalog lookup then checks.
export function isIdentifierOf(
  rules: readonly IdentifierTypeRule[],
  type: IdentifierType,
  value: string,
): boolean {
  const rule = ruleOf(rules, type);
  if (rule === undefined || value.trim() === "") {
    return false;
  }

  return rule.recogniser === null || recognises(rule.recogniser, value);
}

// DOC-lines: a pasted value has a type only when exactly one enabled instance recognises it.
export function detectIdentifierType(
  rules: readonly IdentifierTypeRule[],
  value: string,
): IdentifierType | null {
  const types = recognisingTypesOf(rules, value);
  return types.length === 1 ? (types[0] ?? null) : null;
}

export function recognisingTypesOf(
  rules: readonly IdentifierTypeRule[],
  value: string,
): IdentifierType[] {
  return rules
    .filter((rule) => rule.recogniser !== null && recognises(rule.recogniser, value))
    .map(({ type }) => type);
}

// The value as it is looked up: normalised by its type's recogniser, as typed without one.
export function normalisedOf(
  rules: readonly IdentifierTypeRule[],
  type: IdentifierType,
  value: string,
): string {
  const recogniser = ruleOf(rules, type)?.recogniser ?? null;
  return recogniser === null ? value.trim() : normalise(recogniser, value);
}

// DOC-identifiers: the types are named as the library names them, in the language asked for.
export function identifierLabelOf(
  rules: readonly IdentifierTypeRule[],
  type: IdentifierType,
  language: "cs" | "en",
): string {
  return ruleOf(rules, type)?.labels[language] ?? type;
}
