// ACT-ways-in: which of several photo readers reads a photo. The one the person picked last, kept
// with their settings so it follows them (UI-preferences); the first in the order of Plugins until
// they pick, or once theirs is no longer enabled.

import type { ProposalSettings } from "@vera/contract/proposals";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export function usePhotoReader(readers: ProposalSettings["photoReaders"]) {
  const { data: settings } = useUserSettingsQuery();
  const { mutate } = useUserSettingsMutation();
  const held = settings?.photoReaderId;

  return {
    readerId: readers.some(({ id }) => id === held) ? (held ?? null) : (readers[0]?.id ?? null),
    pickReader: (readerId: string) => mutate({ photoReaderId: readerId }),
  };
}
