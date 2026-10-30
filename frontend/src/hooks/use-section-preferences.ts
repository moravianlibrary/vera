// The open sections on a board, kept with the signed-in person's server settings.

import type { SectionBoard } from "@vera/contract/user-settings";
import { useState } from "react";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export function useSectionPreferences<Id extends string>(board: SectionBoard) {
  const { data: settings } = useUserSettingsQuery();
  const { mutate } = useUserSettingsMutation();
  // A toggle shows at once; the server's answer arrives after.
  const [toggled, setToggled] = useState<Partial<Record<Id, boolean>>>({});
  const isOpen = (id: Id) => toggled[id] ?? settings?.openSections?.[board]?.[id] ?? true;
  const setOpen = (id: Id, open: boolean) => {
    setToggled((current) => ({ ...current, [id]: open }));
    mutate({ openSections: { [board]: { [id]: open } } });
  };
  return { isOpen, setOpen };
}
