// WATCH-delivery: the channels a watchlist reaches a person through, besides browser push: every
// enabled Delivery channel instance whose version says how it reaches a person (PLG-declares), by
// the email on their account or by a handle read from an identity claim. Each is named by its
// instance's name. WATCH-channel-off: a person switches one off for every watchlist.

import type { WatchlistChannel } from "@vera/contract/watchlists";
import { pushChannelId } from "@vera/contract/watchlists";
import { database } from "@/mocks/database";
import { slackHandles } from "@/mocks/fixtures/message-channels";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";
import { userSettingsOf } from "@/mocks/user-settings";

// What the identity providers said at each person's last login, by claim: only the `slack_id`
// of those who sign in with MZK Keycloak so far.
const identityClaims: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  slack_id: slackHandles,
};

export function claimOf(userId: string, claim: string): string | null {
  return identityClaims[claim]?.[userId] ?? null;
}

export interface DeliveryChannel extends WatchlistChannel {
  readonly interface: string;
}

// In the instances' order, for this person.
export function watchlistChannelsOf(userId: string): DeliveryChannel[] {
  const user = database.users.find((candidate) => candidate.id === userId);
  return enabledInstancesOf("DeliveryChannel").flatMap((instance) => {
    const declares = implementationOf(instance)?.versions.find(
      (version) => version.version === instance.version,
    )?.declares;
    const reach = declares?.personReach ?? null;
    if (reach === null || declares === undefined) {
      return [];
    }

    return [
      {
        id: instance.id,
        name: instance.name,
        interface: declares.channelInterface ?? "Email",
        reach,
        canReach:
          reach.by === "email"
            ? (user?.email ?? null) !== null
            : claimOf(userId, reach.claim) !== null,
      },
    ];
  });
}

// WATCH-channel-off, WATCH-do-not-send: whether this kind is stopped for every watchlist.
export function isChannelOffForAll(userId: string, channelId: string): boolean {
  const notifications = userSettingsOf(userId).notifications;
  return (
    notifications?.doNotSend === true || (notifications?.channelsOff ?? []).includes(channelId)
  );
}

export function isPushOffForAll(userId: string): boolean {
  return isChannelOffForAll(userId, pushChannelId);
}
