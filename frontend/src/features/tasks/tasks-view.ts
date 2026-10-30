// The Tasks view's declaration (component-interfaces.md §9.2; docs/demos/shared/page-tasks.js
// `filterBar`): its filter in the URL, State and Trigger on the bar, Plugin, Started by and
// Started date as added filters, and `?run=` naming the open run. Started by is for `task.read` only: with
// `task.read_own` every run is the person's own. No grouping.

import type { RunQuery } from "@vera/contract/tasks";
import { isSameRunQuery, parseRunSearchParams, toRunSearchParams } from "@vera/contract/tasks";
import { runStates, triggerKinds } from "@vera/domain/tasks";
import { runStateLabels } from "@/components/run-state-badge";
import { triggerLabels } from "@/features/tasks/task-words";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const runParam = "run";

export const tasksView: ViewDefinition<RunQuery> = {
  view: "tasks",
  toSearchParams: toRunSearchParams,
  parseSearchParams: parseRunSearchParams,
  isSameQuery: isSameRunQuery,
  fields: [
    {
      key: "states",
      label: "tasks:tasksView.state",
      field: vocabulary(runStates, runStateLabels),
      isQuick: true,
    },
    {
      key: "triggers",
      label: "tasks:tasksView.trigger",
      field: vocabulary(triggerKinds, triggerLabels),
      isQuick: true,
    },
    {
      key: "instanceIds",
      label: "tasks:tasksView.plugin",
      field: { kind: "reference", reference: "pluginInstances" },
    },
    {
      key: "startedBy",
      label: "tasks:tasksView.startedBy",
      field: { kind: "reference", reference: "users" },
    },
    { key: "started", label: "tasks:tasksView.started", field: { kind: "dateRange" } },
  ],
  groupings: [],
  groupingParam: "group",
};

// The fields a person may filter by: Started by needs everyone's runs.
export function runFieldsFor(seesEveryone: boolean) {
  return tasksView.fields.filter((field) => seesEveryone || field.key !== "startedBy");
}
