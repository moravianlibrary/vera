import { useEffect, useState } from "react";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export type Appearance = "system" | "light" | "dark";

export const appearances: readonly Appearance[] = ["system", "light", "dark"];

// Puts the appearance on the page, following the system's own while it is "system".
function useAppliedAppearance(appearance: Appearance): void {
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
  const appearance: Appearance = settings?.appearance ?? "system";
  useAppliedAppearance(appearance);

  return {
    appearance,
    setAppearance: (value: Appearance) => update.mutateAsync({ appearance: value }),
  };
}

const pickedKey = "vera.appearance";

function storedPick(): Appearance {
  try {
    const stored = window.localStorage.getItem(pickedKey);
    return appearances.find((appearance) => appearance === stored) ?? "system";
  } catch {
    return "system";
  }
}

// Before logging in there are no settings: this browser's own pick, or the system's. Once
// logged in, the person's setting applies instead.
export function usePickedAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(storedPick);
  useAppliedAppearance(appearance);

  return {
    appearance,
    setAppearance: (value: Appearance) => {
      setAppearance(value);
      try {
        window.localStorage.setItem(pickedKey, value);
      } catch {
        // Without storage the pick lasts for this page.
      }
    },
  };
}
