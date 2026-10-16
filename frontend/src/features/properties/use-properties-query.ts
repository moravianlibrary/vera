// The property definitions, read by the Properties page, every record pane and every filter bar
// that offers a property (DOC-property-filter). Changing one refetches what shows it.

import { useQuery } from "@tanstack/react-query";
import { fetchPropertyIndex } from "@/api/properties";
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
