import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { startMockClock } from "./today";
import { flushWatchlistChat, flushWatchlistMail } from "./watchlist-delivery";

export const worker = setupWorker(...handlers);
startMockClock();
// The mock has no background server. Reconcile while this browser tab is open.
flushWatchlistMail();
flushWatchlistChat();
window.setInterval(() => {
  flushWatchlistMail();
  flushWatchlistChat();
}, 60_000);
