// The channels a watchlist reaches the person through (WATCH-delivery), shared by the Watchlists
// preferences and Preferences → Notifications: browser push, then each Delivery channel instance that can
// reach them, named by the instance's name. WATCH-channel-off: each one off for every watchlist.

import { useQuery } from "@tanstack/react-query";
import type { UserSettings } from "@vera/contract/user-settings";
import type { WatchlistChannel } from "@vera/contract/watchlists";
import { pushChannelId } from "@vera/contract/watchlists";
import { listWatchlistChannels } from "@/api/watchlists";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";

export const pushChannelName = "preferences:channels.browserPush";

export function useWatchlistChannelsQuery() {
  return useQuery({
    queryKey: [...watchlistsQueryKey, "channels"],
    queryFn: listWatchlistChannels,
  });
}

// Why a channel cannot reach the person, beside its switch; null when it can.
export function unreachableTextOf(channel: WatchlistChannel): string | null {
  if (channel.canReach) {
    return null;
  }

  return channel.reach.by === "email"
    ? i18n.t("preferences:channels.noEmail")
    : i18n.t("preferences:channels.noClaim", { claim: channel.reach.claim });
}

export function isOffForAll(settings: UserSettings | undefined, channelId: string): boolean {
  return (settings?.notifications?.channelsOff ?? []).includes(channelId);
}

export function isPushOffForAll(settings: UserSettings | undefined): boolean {
  return isOffForAll(settings, pushChannelId);
}
