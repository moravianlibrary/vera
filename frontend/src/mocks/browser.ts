import { setupWorker } from "msw/browser";
import { env } from "@/config/env";
import { pushQuietMilliseconds } from "@/domain/watchlist-push";
import { handlers } from "./handlers";
import { resolveSession } from "./session";
import { startMockClock } from "./today";
import { flushWatchlistChat, flushWatchlistMail, flushWatchlistPush } from "./watchlist-delivery";

export const worker = setupWorker(...handlers);
startMockClock();
// The mock has no background server. Reconcile while this browser tab is open.
flushWatchlistMail();
flushWatchlistChat();
window.setInterval(() => {
  flushWatchlistMail();
  flushWatchlistChat();
}, 60_000);

// WATCH-push: the mock has no push service, so it shows the signed-in person's pushes from this
// tab itself, as the browser would from a push.
window.setInterval(() => {
  const userId = resolveSession(env.VITE_MOCK_USER).user.id;
  for (const push of flushWatchlistPush(new Date(), [userId])) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(push.title, { body: push.body, tag: `watchlist-${push.watchlistId}` });
    }
  }
}, pushQuietMilliseconds);
