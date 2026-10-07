// What an intention's Mix page reads from its URL (intentions.md §2.4): the intention in the
// path, `/intentions/ID/mix`, and `?c=` the category open in the pane, none for *All
// categories*. Intentions links here with *Edit mix*, Categories with Overall's.

export function intentionMixHrefOf(intentionId: string, categoryId: string | null = null): string {
  const path = `/intentions/${encodeURIComponent(intentionId)}/mix`;
  return categoryId === null ? path : `${path}?${new URLSearchParams({ c: categoryId })}`;
}
