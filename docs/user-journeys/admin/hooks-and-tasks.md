# Keep notifications and background work running

**Who.** An administrator: Petr Dvořák.

**Goal.** "Make sure the right people are told, and that nothing is stuck."

**Starting state.**
- A webhook hook whose endpoint is down has a delivery that gave up.
- A batch had additions that failed.
- A scheduled harvester run failed.

## Steps

1. On *Hooks* he creates a hook on `iteration.published` that mails the askers, with a
   preference *Tell me when my document is available*, on by default.
   → Recipients can switch it off in their preferences
   ([HOOK-recipient](../../reference/integrations/hooks.md#hook-recipient)).
2. He finds the delivery that gave up, fixes the endpoint, and retries it.
   → A new attempt is made ([HOOK-retry](../../reference/integrations/hooks.md#hook-retry)).
3. He pauses a noisy hook with a reason.
   → It takes no new events ([HOOK-paused](../../reference/integrations/hooks.md#hook-paused)).
4. On *Documents*, grouped by batch, he retries the failed additions.
   → They go back to ingest with their attempt counted
   ([ACT-retry-batch](../../reference/access/acts.md#proposal-review)).
5. On *Tasks* he finds the failed run and runs it again.
   → A new run, linked to the old ([ACT-run-again](../../reference/access/acts.md#tasks-and-schedules)).
6. On *Schedules* he pauses the harvester's schedule with a reason, and later resumes it
   ([ACT-schedule-pause](../../reference/access/acts.md#tasks-and-schedules)).

## Rules

[HOOK-model](../../reference/integrations/hooks.md#hook-model) ·
[HOOK-batch](../../reference/integrations/hooks.md#hook-batch) ·
[ACT-hook-save](../../reference/access/acts.md#hooks) ·
[VIEW-tasks](../../reference/access/views.md#view-tasks)
