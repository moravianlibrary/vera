// ☰ before a page's title on the small tier and the phone, where the sidebar is a sheet opened
// only from here (component-interfaces.md §8; decided 2026-10-06: no bar of its own, nothing
// fixed at the bottom). The shell provides what opens the sheet; where the sidebar is docked it
// provides nothing and the button is absent.

import { Menu } from "lucide-react";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export const OpenNavigationContext = createContext<(() => void) | null>(null);

export function NavigationButton() {
  const { t } = useTranslation("common");
  const openNavigation = useContext(OpenNavigationContext);
  if (openNavigation === null) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-2 shrink-0"
      onClick={openNavigation}
      aria-label={t("navigation.open")}
    >
      <Menu />
    </Button>
  );
}
