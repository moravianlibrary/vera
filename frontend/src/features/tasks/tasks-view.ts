// The Tasks view's declaration (component-interfaces.md §9.2; docs/demos/shared/page-tasks.js
// `filterBar`): its filter in the URL, State and Trigger on the bar, Plugin and Started by as
// chips, and `?run=` naming the open run. Started by is for `task.read` only: with
// `task.read_own` every run is the person's own. No watchlists and no grouping: the demo's runs
// are read for a moment, not watched.
// TODO(rrandiak): labels move to i18n.

import type { RunQuery } from "@/api/tasks";
import { isSameRunQuery, parseRunSearchParams, toRunSearchParams } from "@/api/tasks";
import { runStateLabels } from "@/components/run-state-badge";
import { finishedRunStates, triggerKinds } from "@/domain/tasks";
import { triggerLabels } from "@/features/tasks/task-words";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const runParam = "run";

export const tasksView: ViewDefinition<RunQuery> = {
  toSearchParams: toRunSearchParams,
  parseSearchParams: parseRunSearchParams,
  isSameQuery: isSameRunQuery,
  fields: [
    {
      key: "states",
      label: "State",
      field: vocabulary(finishedRunStates, runStateLabels),
      isQuick: true,
    },
    {
      key: "triggers",
      label: "Trigger",
      field: vocabulary(triggerKinds, triggerLabels),
      isQuick: true,
    },
    {
      key: "instanceIds",
      label: "Plugin",
      field: { kind: "reference", reference: "pluginInstances" },
    },
    { key: "startedBy", label: "Started by", field: { kind: "reference", reference: "users" } },
  ],
  groupings: [],
  groupingParam: "group",
};

// The fields a person may filter by: Started by needs everyone's runs.
export function runFieldsFor(seesEveryone: boolean) {
  return tasksView.fields.filter((field) => seesEveryone || field.key !== "startedBy");
}
