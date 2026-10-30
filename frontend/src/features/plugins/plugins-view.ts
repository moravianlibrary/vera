// Plugins' state in its URL (docs/demos/shared/page-plugins.js; STATUS "Plugins"): the search,
// *Type* and *State* narrow the table, and `?i=` opens an instance in the drawer, `?impl=` an
// implementation's contract. `?i=` is the parameter every other view links an instance with
// (STATUS *Cross-page links land on the record*). The page holds every record already, so the
// filter is applied here: an instance matches by its name, its implementation's or its
// configuration; an implementation shows with the instances that match, or, with no *State*
// picked, when its own name does, so one with no instance can still be found.

import type {
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
} from "@vera/contract/plugins";
import type { PluginKind } from "@vera/domain/plugins";
import { pluginKinds } from "@vera/domain/plugins";
import type { Facets } from "@/components/filters/filter-bar";
import { pluginKindLabels } from "@/features/plugins/plugin-words";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const instanceStates = ["enabled", "disabled"] as const;
export type InstanceState = (typeof instanceStates)[number];

export const instanceStateLabels = {
  enabled: "plugins:pluginsView.enabled",
  disabled: "plugins:pluginsView.disabled",
} as const satisfies Record<InstanceState, string>;

export interface PluginQuery {
  readonly search?: string;
  readonly kinds?: readonly PluginKind[];
  readonly states?: readonly InstanceState[];
}

const searchParam = "q";
const kindParam = "kind";
const stateParam = "state";
export const instanceParam = "i";
export const implementationParam = "impl";

function listOf<Value extends string>(
  params: URLSearchParams,
  name: string,
  values: readonly Value[],
): Value[] | undefined {
  const picked = (params.get(name) ?? "")
    .split(",")
    .filter((value): value is Value => (values as readonly string[]).includes(value));
  return picked.length === 0 ? undefined : [...new Set(picked)];
}

function parsePluginSearchParams(params: URLSearchParams): PluginQuery {
  return {
    search: params.get(searchParam)?.trim() || undefined,
    kinds: listOf(params, kindParam, pluginKinds),
    states: listOf(params, stateParam, instanceStates),
  };
}

function toPluginSearchParams(query: PluginQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(searchParam, search);
  }

  for (const [name, values] of [
    [kindParam, query.kinds],
    [stateParam, query.states],
  ] as const) {
    if (values !== undefined && values.length > 0) {
      params.set(name, values.toSorted().join(","));
    }
  }

  return params;
}

export const pluginsView: ViewDefinition<PluginQuery> = {
  toSearchParams: toPluginSearchParams,
  parseSearchParams: parsePluginSearchParams,
  isSameQuery: (first, second) =>
    toPluginSearchParams(first).toString() === toPluginSearchParams(second).toString(),
  fields: [
    {
      key: "kinds",
      label: "plugins:pluginsView.type",
      field: vocabulary(pluginKinds, pluginKindLabels),
      isQuick: true,
    },
    {
      key: "states",
      label: "plugins:pluginsView.state",
      field: vocabulary(instanceStates, instanceStateLabels),
      isQuick: true,
    },
  ],
  groupings: [],
  groupingParam: "group",
};

// Where another view opens an instance.
export function pluginInstanceHrefOf(instanceId: string): string {
  return `/plugins?${instanceParam}=${encodeURIComponent(instanceId)}`;
}

// ---------------------------------------------------------------- the open record

export type PluginSelection =
  | { kind: "instance"; instance: PluginInstanceDetail; implementation: PluginImplementation }
  | { kind: "implementation"; implementation: PluginImplementation };

export function selectionOf(params: URLSearchParams, index: PluginIndex): PluginSelection | null {
  const instance = index.instances.find((candidate) => candidate.id === params.get(instanceParam));
  const implementationOf = (implementationId: string | null) =>
    index.implementations.find((candidate) => candidate.id === implementationId);
  if (instance !== undefined) {
    const implementation = implementationOf(instance.implementationId);
    return implementation === undefined ? null : { kind: "instance", instance, implementation };
  }

  const implementation = implementationOf(params.get(implementationParam));
  return implementation === undefined ? null : { kind: "implementation", implementation };
}

// ---------------------------------------------------------------- what the table shows

function matches(search: string | undefined, ...texts: readonly string[]): boolean {
  const needle = search?.trim().toLowerCase();
  return (
    needle === undefined ||
    needle === "" ||
    texts.some((text) => text.toLowerCase().includes(needle))
  );
}

export function configurationText(instance: PluginInstanceDetail): string {
  return [
    ...Object.entries(instance.configuration).map(([key, value]) => `${key}=${value}`),
    ...instance.secretsSet.map((key) => `${key}=•••`),
  ].join(" · ");
}

const stateOf = (instance: PluginInstanceDetail): InstanceState =>
  instance.isEnabled ? "enabled" : "disabled";

export interface ShownPlugins {
  readonly implementations: readonly PluginImplementation[];
  readonly instances: readonly PluginInstanceDetail[];
}

export function shownPluginsOf(index: PluginIndex, query: PluginQuery): ShownPlugins {
  const kinds = query.kinds ?? [];
  const states = query.states ?? [];
  const implementations = index.implementations.filter(
    (implementation) => kinds.length === 0 || kinds.includes(implementation.kind),
  );
  const instances = index.instances.filter((instance) => {
    const implementation = implementations.find(
      (candidate) => candidate.id === instance.implementationId,
    );
    return (
      implementation !== undefined &&
      (states.length === 0 || states.includes(stateOf(instance))) &&
      matches(query.search, instance.name, implementation.name, configurationText(instance))
    );
  });
  return {
    implementations: implementations.filter(
      (implementation) =>
        instances.some((instance) => instance.implementationId === implementation.id) ||
        (states.length === 0 && matches(query.search, implementation.name)),
    ),
    instances,
  };
}

// How many instances each Type and State would find, over the search and the other field.
export function pluginFacetsOf(index: PluginIndex, query: PluginQuery): Facets {
  return {
    kinds: pluginKinds.map((kind) => ({
      value: kind,
      count: shownPluginsOf(index, { ...query, kinds: [kind] }).instances.length,
    })),
    states: instanceStates.map((state) => ({
      value: state,
      count: shownPluginsOf(index, { ...query, states: [state] }).instances.length,
    })),
  };
}
