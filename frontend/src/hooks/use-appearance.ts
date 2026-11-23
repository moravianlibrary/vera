// UI-appearance: kept as the language is. Before the person holds one, it is the one picked on the
// login page, else the one this browser kept, else the system's; the first login keeps it as
// theirs, and a pick on the login page replaces the one they hold. The browser keeps the
// appearance last picked or used in it, for the login page.

import { useEffect, useState } from "react";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export type Appearance = "system" | "light" | "dark";

export const appearances: readonly Appearance[] = ["system", "light", "dark"];

const loginPickKey = "vera.login-appearance";
const keptKey = "vera.appearance";

function appearanceOf(stored: string | null): Appearance | null {
  return appearances.find((appearance) => appearance === stored) ?? null;
}

// The appearance last picked or used in this browser.
export function keptAppearance(): Appearance | null {
  try {
    return appearanceOf(window.localStorage.getItem(keptKey));
  } catch {
    return null;
  }
}

function keepAppearance(appearance: Appearance): void {
  try {
    window.localStorage.setItem(keptKey, appearance);
  } catch {
    // Without storage the login page follows the system's.
  }
}

// The login page's pick lasts across an identity provider's redirect, in this tab only, and the
// browser keeps it.
export function pickLoginAppearance(appearance: Appearance): void {
  try {
    window.sessionStorage.setItem(loginPickKey, appearance);
  } catch {
    // Without storage the pick lasts only for this page.
  }
  keepAppearance(appearance);
}

export function loginAppearancePick(): Appearance | null {
  try {
    return appearanceOf(window.sessionStorage.getItem(loginPickKey));
  } catch {
    return null;
  }
}

export function forgetLoginAppearancePick(): void {
  try {
    window.sessionStorage.removeItem(loginPickKey);
  } catch {
    // Nothing was kept.
  }
}

// What the interface looks like: a fresh login pick, the person's own, else this browser's.
export function appearanceInUse(
  held: Appearance | undefined,
  picked: Appearance | null,
): Appearance {
  return picked ?? held ?? keptAppearance() ?? "system";
}

// What to save as the person's: a login pick replaces theirs, and a first login keeps the one in
// use. Null when nothing changes.
export function appearanceToSave(
  held: Appearance | undefined,
  picked: Appearance | null,
): Appearance | null {
  const inUse = appearanceInUse(held, picked);
  return inUse === held ? null : inUse;
}

// Puts the appearance on the page, following the system's own while it is "system".
function usePageAppearance(appearance: Appearance): void {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && media.matches),
      );
      document.documentElement.style.colorScheme =
        appearance === "system" ? (media.matches ? "dark" : "light") : appearance;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
}

// The signed-in person's appearance, kept with their settings.
export function useAppearance() {
  const { data: settings } = useUserSettingsQuery();
  const update = useUserSettingsMutation();

  return {
    appearance: appearanceInUse(settings?.appearance, loginAppearancePick()),
    setAppearance: (value: Appearance) => update.mutateAsync({ appearance: value }),
  };
}

// Once, in the shell: applies the appearance to the page, keeps it in this browser for the login
// page, and saves it as the person's when they first log in or pick one on the login page.
export function useAppliedAppearance(): void {
  const { data: settings, isSuccess } = useUserSettingsQuery();
  const { mutate } = useUserSettingsMutation();
  const held = settings?.appearance;
  const picked = loginAppearancePick();
  const appearance = appearanceInUse(held, picked);
  usePageAppearance(appearance);

  useEffect(() => {
    keepAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const toSave = appearanceToSave(held, picked);
    if (toSave === null) {
      forgetLoginAppearancePick();
      return;
    }

    mutate({ appearance: toSave }, { onSuccess: forgetLoginAppearancePick });
  }, [isSuccess, held, picked, mutate]);
}

// Before logging in there are no settings: this browser's own appearance, or the system's.
export function usePickedAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(() => keptAppearance() ?? "system");
  usePageAppearance(appearance);

  return {
    appearance,
    setAppearance: (value: Appearance) => {
      setAppearance(value);
      pickLoginAppearance(value);
    },
  };
}
