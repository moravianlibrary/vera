import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { startMockClock } from "./today";

export const worker = setupWorker(...handlers);
startMockClock();
