// The property definitions, read by the Properties page, every record pane and every filter bar
// that offers a property (DOC-property-filter). Changing one refetches what shows it.

import { useQuery } from "@tanstack/react-query";
import { fetchPropertyIndex } from "@/api/properties";
import type { PropertyDefinition } from "@/domain/properties";
import { pageCountKey } from "@/domain/properties";
import { accessQueryKey } from "@/features/access/use-access-query";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const propertiesQueryKey = ["properties"] as const;
export const propertyInvalidations = [
  propertiesQueryKey,
  documentsQueryKey,
  accessQueryKey,
  watchlistsQueryKey,
] as const;

export function usePropertiesQuery() {
  return useQuery({ queryKey: propertiesQueryKey, queryFn: fetchPropertyIndex });
}

// The properties a page filters on (DOC-property-filter): those it shows that the person may
// read, public ones only in public detail, and not the page count, which has its Pages filter.
// A page whose own filter already reads a property leaves it out: Requests' Type.
export function filterablePropertiesOf(
  definitions: readonly PropertyDefinition[] | undefined,
  isPublic: boolean,
  without: readonly string[] = [],
): PropertyDefinition[] {
  return (definitions ?? []).filter(
    (definition) =>
      definition.key !== pageCountKey &&
      !without.includes(definition.key) &&
      (!isPublic || definition.visibility === "public"),
  );
}
