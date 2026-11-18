import { z } from "zod";

export const namesSchema = z
  .object({
    cs: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .refine(
    (names) => names.cs !== undefined || names.en !== undefined,
    "Give it a name in at least one language",
  );

export type Names = z.infer<typeof namesSchema>;

export function otherLanguage(language: "cs" | "en"): "cs" | "en" {
  return language === "cs" ? "en" : "cs";
}

export function nameIn(names: Names, language: "cs" | "en"): string {
  return names[language] ?? names[language === "cs" ? "en" : "cs"] ?? "";
}

export function namesAfterEdit(names: Names, language: "cs" | "en", value: string): Names {
  return { ...names, [language]: value };
}

export function namesToSave(names: Names): Names {
  const cs = names.cs?.trim();
  const en = names.en?.trim();
  return {
    ...(cs ? { cs } : {}),
    ...(en ? { en } : {}),
  };
}
