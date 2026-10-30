// The interface's messages, in English and Czech: one file per namespace and language under
// locales/, flat keys such as "permission.<key>.line". Built in English; the Czech files start as
// copies of the English ones until the Czech terms are settled.
// Initialised on import, synchronously, so plain functions, the tests and the docs generator read
// messages without waiting. It starts in English, which the tests and the generated tables read;
// the shell switches it to the language in use (UI-language).

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import csAccess from "@/i18n/locales/cs/access.json";
import csCategories from "@/i18n/locales/cs/categories.json";
import csCommon from "@/i18n/locales/cs/common.json";
import csDocuments from "@/i18n/locales/cs/documents.json";
import csHistory from "@/i18n/locales/cs/history.json";
import csIntentions from "@/i18n/locales/cs/intentions.json";
import csLists from "@/i18n/locales/cs/lists.json";
import csProjects from "@/i18n/locales/cs/projects.json";
import csRequests from "@/i18n/locales/cs/requests.json";
import csSystem from "@/i18n/locales/cs/system.json";
import csValidations from "@/i18n/locales/cs/validations.json";
import enAccess from "@/i18n/locales/en/access.json";
import enCategories from "@/i18n/locales/en/categories.json";
import enCommon from "@/i18n/locales/en/common.json";
import enDocuments from "@/i18n/locales/en/documents.json";
import enHistory from "@/i18n/locales/en/history.json";
import enIntentions from "@/i18n/locales/en/intentions.json";
import enLists from "@/i18n/locales/en/lists.json";
import enProjects from "@/i18n/locales/en/projects.json";
import enRequests from "@/i18n/locales/en/requests.json";
import enSystem from "@/i18n/locales/en/system.json";
import enValidations from "@/i18n/locales/en/validations.json";

export const resources = {
  en: {
    access: enAccess,
    common: enCommon,
    system: enSystem,
    history: enHistory,
    documents: enDocuments,
    requests: enRequests,
    validations: enValidations,
    lists: enLists,
    projects: enProjects,
    intentions: enIntentions,
    categories: enCategories,
  },
  cs: {
    access: csAccess,
    common: csCommon,
    system: csSystem,
    history: csHistory,
    documents: csDocuments,
    requests: csRequests,
    validations: csValidations,
    lists: csLists,
    projects: csProjects,
    intentions: csIntentions,
    categories: csCategories,
  },
} as const;

export const i18n = i18next.createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  ns: [
    "access",
    "common",
    "system",
    "history",
    "documents",
    "requests",
    "validations",
    "lists",
    "projects",
    "intentions",
    "categories",
  ],
  defaultNS: "access",
  keySeparator: false,
  initAsync: false,
  // React escapes what it shows, and the generated tables take the text as written.
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});
