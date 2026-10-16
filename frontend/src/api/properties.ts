// Calls the properties endpoints; what they take and answer is in @vera/contract/properties.

import type {
  BulkPropertyEntry,
  BulkPropertyEntryResult,
  NewProperty,
  PropertyEntry,
  PropertyEntryResult,
  PropertyImpact,
  PropertyIndex,
} from "@vera/contract/properties";
import {
  bulkPropertyEntryResultSchema,
  bulkPropertyRoute,
  documentPropertyRoute,
  propertyEntryResultSchema,
  propertyImpactRoute,
  propertyImpactSchema,
  propertyIndexSchema,
  propertyRoute,
} from "@vera/contract/properties";
import { apiRoutes } from "@vera/contract/routes";
import type { PropertyDefinition } from "@vera/domain/properties";
import { propertyDefinitionSchema } from "@vera/domain/properties";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

// ---------------------------------------------------------------- calls

export async function fetchPropertyIndex(): Promise<PropertyIndex> {
  return getJson(apiRoutes.properties, propertyIndexSchema);
}

export async function createProperty(property: NewProperty): Promise<PropertyDefinition> {
  return postJson(apiRoutes.properties, property, propertyDefinitionSchema);
}

export async function saveProperty(property: NewProperty): Promise<PropertyDefinition> {
  return putJson(propertyRoute(property.key), property.draft, propertyDefinitionSchema);
}

export async function fetchPropertyImpact(key: string): Promise<PropertyImpact> {
  return getJson(propertyImpactRoute(key), propertyImpactSchema);
}

export async function deleteProperty(key: string): Promise<void> {
  return deleteResource(propertyRoute(key));
}

export async function enterPropertyValue({
  documentId,
  key,
  entry,
}: {
  documentId: string;
  key: string;
  entry: PropertyEntry;
}): Promise<PropertyEntryResult> {
  return putJson(documentPropertyRoute(documentId, key), entry, propertyEntryResultSchema);
}

export async function enterPropertyValues({
  key,
  entry,
}: {
  key: string;
  entry: BulkPropertyEntry;
}): Promise<BulkPropertyEntryResult> {
  return postJson(bulkPropertyRoute(key), entry, bulkPropertyEntryResultSchema);
}
