// The channels a watchlist reaches the person through (WATCH-delivery), shared by the Watchlists
// page and Preferences → Notifications: browser push, then each Delivery channel instance that can
// reach them, named by the instance's name. WATCH-channel-off: each one off for every watchlist.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import type { UserSettings } from "@/api/user-settings";
import type { WatchlistChannel } from "@/api/watchlists";
import { listWatchlistChannels, pushChannelId } from "@/api/watchlists";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const pushChannelName = "Browser push";

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
    ? "Cannot reach you: your account has no email address."
    : `Cannot reach you: your login gives it no ${channel.reach.claim}.`;
}

export function isOffForAll(settings: UserSettings | undefined, channelId: string): boolean {
  return (settings?.notifications?.channelsOff ?? []).includes(channelId);
}

export function isPushOffForAll(settings: UserSettings | undefined): boolean {
  return isOffForAll(settings, pushChannelId);
}
