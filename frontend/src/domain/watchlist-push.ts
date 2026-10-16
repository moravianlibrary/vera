// A watchlist's browser push (WATCH-push): what it says, and when a person's batch for one
// watchlist is sent. A batch goes once nothing new has entered for a few seconds, and soon after
// its first record at most, so a burst is one notification.

export const pushQuietMilliseconds = 5_000;
export const pushLongestMilliseconds = 30_000;
const namedInPush = 3;

export interface PushNotice {
  title: string;
  body: string;
}

// The watchlist, and the records that entered it: the first three by name, the rest as a count.
export function pushNoticeOf(watchlistName: string, recordNames: readonly string[]): PushNotice {
  const named = recordNames.slice(0, namedInPush).join(", ");
  const rest = recordNames.length - namedInPush;
  return { title: watchlistName, body: rest > 0 ? `${named} +${rest} more` : named };
}

// Whether a batch whose records entered at these moments is due at `now`.
export function isPushDue(enteredAt: readonly Date[], now: Date): boolean {
  if (enteredAt.length === 0) {
    return false;
  }

  const times = enteredAt.map((moment) => moment.getTime());
  return (
    now.getTime() - Math.max(...times) >= pushQuietMilliseconds ||
    now.getTime() - Math.min(...times) >= pushLongestMilliseconds
  );
}
