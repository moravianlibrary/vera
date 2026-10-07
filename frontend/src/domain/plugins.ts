// A plugin instance as other records name it (plugins.md §1, §4): what a run, a schedule or a
// filter points at. Its configuration, versions and contract are Plugins' own (step 10).

import { z } from "zod";

// plugins.md §4.1–§4.13.
export const pluginKinds = [
  "CatalogAdapter",
  "Registry",
  "Harvester",
  "PropertySource",
  "Validation",
  "Restriction",
  "Custody",
  "Input",
  "ListGenerator",
  "Identity",
  "Message",
  "DeliveryChannel",
  "Classifier",
] as const;
export const pluginKindSchema = z.enum(pluginKinds);
export type PluginKind = z.infer<typeof pluginKindSchema>;

export const pluginInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  // The implementation it runs: "AlephCatalogAdapter".
  plugin: z.string(),
  kind: pluginKindSchema,
  isEnabled: z.boolean(),
});
export type PluginInstance = z.infer<typeof pluginInstanceSchema>;
