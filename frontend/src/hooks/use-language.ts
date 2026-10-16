// The language the interface speaks (UI-language), and the person's choice of it.

import type { Language } from "@vera/contract/user-settings";
import { useEffect } from "react";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { i18n } from "@/i18n";
import {
  forgetLoginLanguagePick,
  languageInUse,
  languageToSave,
  loginLanguagePick,
} from "@/i18n/language";

export function useLanguage() {
  const { data: settings } = useUserSettingsQuery();
  const update = useUserSettingsMutation();
  return {
    language: languageInUse(settings?.language, loginLanguagePick()),
    setLanguage: (value: Language) => update.mutateAsync({ language: value }),
  };
}

// Once, in the shell: applies the language to the messages and the page, and saves it as the
// person's when they first log in or pick one on the login page.
export function useAppliedLanguage(): void {
  const { data: settings, isSuccess } = useUserSettingsQuery();
  const { mutate } = useUserSettingsMutation();
  const held = settings?.language;
  const picked = loginLanguagePick();
  const language = languageInUse(held, picked);

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const toSave = languageToSave(held, picked);
    if (toSave === null) {
      forgetLoginLanguagePick();
      return;
    }

    mutate({ language: toSave }, { onSuccess: forgetLoginLanguagePick });
  }, [isSuccess, held, picked, mutate]);
}
