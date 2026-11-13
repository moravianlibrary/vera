// Hooks' URL filters, subject grouping and seven-day activity (STATUS "Hooks").

import type { Hook, HookIndex } from "@vera/contract/hooks";
import { hookGroupOfEvent, hookGroups, hookInterfaceSchema } from "@vera/contract/hooks";
import type { Facets } from "@/components/filters/filter-bar";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const interfaces = hookInterfaceSchema.options;
const states = ["active", "paused", "gave_up"] as const;
export interface HooksQuery {
  readonly search?: string;
  readonly kinds?: readonly string[];
  readonly states?: readonly string[];
}

const interfaceLabels = {
  Email: "hooks:hooksView.email",
  Chat: "hooks:hooksView.chat",
  Webhook: "hooks:hooksView.webhook",
  File: "hooks:hooksView.file",
} as const;
const stateLabels = {
  active: "hooks:hooksView.active",
  paused: "hooks:hooksView.paused",
  gave_up: "hooks:hooksView.needsAttention",
} as const;

function selected(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
): string[] | undefined {
  const found = (params.get(key) ?? "").split(",").filter((value) => values.includes(value));
  return found.length === 0 ? undefined : [...new Set(found)];
}

export const hooksView: ViewDefinition<HooksQuery> = {
  parseSearchParams: (params) => ({
    search: params.get("q")?.trim() || undefined,
    kinds: selected(params, "kind", interfaces),
    states: selected(params, "state", states),
  }),
  toSearchParams: (query) => {
    const params = new URLSearchParams();
    if (query.search?.trim()) params.set("q", query.search.trim());
    if (query.kinds?.length) params.set("kind", query.kinds.join(","));
    if (query.states?.length) params.set("state", query.states.join(","));
    return params;
  },
  isSameQuery: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  fields: [
    {
      key: "kinds",
      label: "hooks:hooksView.channel",
      field: vocabulary(interfaces, interfaceLabels),
      isQuick: true,
    },
    {
      key: "states",
      label: "hooks:hooksView.state",
      field: vocabulary(states, stateLabels),
      isQuick: true,
    },
  ],
  groupings: [],
  groupingParam: "group",
};

export function hookGroupOf(hook: Hook): (typeof hookGroups)[number] {
  return hookGroupOfEvent(hook.events[0]);
}

export function hookStateOf(index: HookIndex, hook: Hook): string[] {
  return [
    hook.state,
    ...(index.deliveries.some(
      (delivery) => delivery.hookId === hook.id && delivery.state === "gave_up",
    )
      ? ["gave_up"]
      : []),
  ];
}

export function shownHooksOf(index: HookIndex, query: HooksQuery): Hook[] {
  const needle = query.search?.toLowerCase();
  return index.hooks
    .filter((hook) => {
      const channel = index.channels.find((candidate) => candidate.id === hook.channelId);
      return (
        (!query.kinds?.length ||
          (channel !== undefined && query.kinds.includes(channel.interface))) &&
        (!query.states?.length ||
          query.states.some((state) => hookStateOf(index, hook).includes(state))) &&
        (!needle ||
          [
            hook.name,
            ...hook.events,
            JSON.stringify(hook.conditions),
            hook.recipient,
            channel?.name ?? "",
          ].some((value) => value.toLowerCase().includes(needle)))
      );
    })
    .sort(
      (left, right) =>
        hookGroups.indexOf(hookGroupOf(left)) - hookGroups.indexOf(hookGroupOf(right)),
    );
}

export function hookFacetsOf(index: HookIndex, query: HooksQuery): Facets {
  const withKinds = shownHooksOf(index, { ...query, kinds: undefined });
  const withStates = shownHooksOf(index, { ...query, states: undefined });
  return {
    kinds: interfaces.map((value) => ({
      value,
      count: withKinds.filter(
        (hook) =>
          index.channels.find((channel) => channel.id === hook.channelId)?.interface === value,
      ).length,
    })),
    states: states.map((value) => ({
      value,
      count: withStates.filter((hook) => hookStateOf(index, hook).includes(value)).length,
    })),
  };
}

export function activityOf(index: HookIndex, hookId: string): number[] {
  const end = Date.parse(index.asOf);
  const day = 86_400_000;
  return Array.from({ length: 7 }, (_, position) => {
    const start = end - (7 - position) * day;
    return index.attempts.filter((attempt) => {
      const at = Date.parse(attempt.at);
      return (
        index.deliveries.some(
          (delivery) => delivery.id === attempt.deliveryId && delivery.hookId === hookId,
        ) &&
        at >= start &&
        at < start + day
      );
    }).length;
  });
}
