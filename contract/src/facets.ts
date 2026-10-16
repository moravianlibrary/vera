// A filter field's values with how many rows match each, counted over every other active filter
// (filtering.md §2): the shape every filtered resource answers its facets in.

import { z } from "zod";

export function facetCountsOf<Value extends z.ZodType>(value: Value) {
  return z.array(z.object({ value, count: z.number().int() }));
}
