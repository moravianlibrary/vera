// Calls the plugins endpoints; what they take and answer is in @vera/contract/plugins.

import type {
  InstanceDraft,
  InstanceUpgrade,
  NewInstance,
  PluginImpact,
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
  UploadReading,
} from "@vera/contract/plugins";
import {
  instanceUpgradeSchema,
  pluginImpactSchema,
  pluginImplementationSchema,
  pluginIndexSchema,
  pluginInstanceDetailSchema,
  uploadReadingSchema,
} from "@vera/contract/plugins";
import {
  apiRoutes,
  pluginInstanceActionRoute,
  pluginInstanceRoute,
  pluginUploadInstallRoute,
} from "@vera/contract/routes";
import type { Run } from "@vera/contract/tasks";
import { runSchema } from "@vera/contract/tasks";
import { deleteResource, getJson, postForm, postJson, putJson } from "@/api/http";

export async function getPluginIndex(): Promise<PluginIndex> {
  return getJson(apiRoutes.plugins, pluginIndexSchema);
}

export async function createPluginInstance(draft: NewInstance): Promise<PluginInstanceDetail> {
  return postJson(apiRoutes.pluginInstances, draft, pluginInstanceDetailSchema);
}

export async function savePluginInstance(
  instanceId: string,
  draft: InstanceDraft,
): Promise<PluginInstanceDetail> {
  return putJson(pluginInstanceRoute(instanceId), draft, pluginInstanceDetailSchema);
}

export async function enablePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "enable"), {}, pluginInstanceDetailSchema);
}

export async function disablePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "disable"), {}, pluginInstanceDetailSchema);
}

export async function resetPluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "reset"), {}, pluginInstanceDetailSchema);
}

export async function getPluginImpact(instanceId: string): Promise<PluginImpact> {
  return getJson(pluginInstanceActionRoute(instanceId, "impact"), pluginImpactSchema);
}

// Its schedules go with it; its runs stay under retention.
export async function deletePluginInstance(instanceId: string): Promise<void> {
  return deleteResource(pluginInstanceRoute(instanceId));
}

// By hand, now, as a run on Tasks.
export async function runPluginInstance(instanceId: string): Promise<Run> {
  return postJson(pluginInstanceActionRoute(instanceId, "run"), {}, runSchema);
}

export async function getInstanceUpgrade(instanceId: string): Promise<InstanceUpgrade> {
  return getJson(pluginInstanceActionRoute(instanceId, "upgrade"), instanceUpgradeSchema);
}

export async function upgradePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "upgrade"), {}, pluginInstanceDetailSchema);
}

// From an implementation's drawer, the package must be a version of it.
export async function uploadPluginPackage(
  file: File,
  implementationId: string | null,
): Promise<UploadReading> {
  const form = new FormData();
  form.set("file", file);
  if (implementationId !== null) {
    form.set("implementationId", implementationId);
  }

  return postForm(apiRoutes.pluginUploads, form, uploadReadingSchema);
}

export async function installPluginUpload(uploadId: string): Promise<PluginImplementation> {
  return postJson(pluginUploadInstallRoute(uploadId), {}, pluginImplementationSchema);
}
