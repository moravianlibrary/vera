// The interface's messages, in English and Czech: one file per namespace and language under
// locales/, flat keys such as "permission.<key>.line". Built in English; the Czech files start as
// copies of the English ones until the Czech terms are settled.
// Initialised on import, synchronously, so plain functions, the tests and the docs generator read
// messages without waiting. It starts in English, which the tests and the generated tables read;
// the shell switches it to the language in use (UI-language).

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import csAccess from "@/i18n/locales/cs/access.json";
import csSystem from "@/i18n/locales/cs/system.json";
import enAccess from "@/i18n/locales/en/access.json";
import enSystem from "@/i18n/locales/en/system.json";

export const resources = {
  en: { access: enAccess, system: enSystem },
  cs: { access: csAccess, system: csSystem },
} as const;

export const i18n = i18next.createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  ns: ["access", "system"],
  defaultNS: "access",
  keySeparator: false,
  initAsync: false,
  // React escapes what it shows, and the generated tables take the text as written.
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});
