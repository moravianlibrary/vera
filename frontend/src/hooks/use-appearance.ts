import { useEffect } from "react";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export type Appearance = "system" | "light" | "dark";

export function useAppearance() {
  const { data: settings } = useUserSettingsQuery();
  const update = useUserSettingsMutation();
  const appearance: Appearance = settings?.appearance ?? "system";

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

  return {
    appearance,
    setAppearance: (value: Appearance) => update.mutateAsync({ appearance: value }),
  };
}
