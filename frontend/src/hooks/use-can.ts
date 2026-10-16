// Whether the person signed in may do this, to this record (component-interfaces.md §9.6). An
// action they may not do is not offered at all (view-rules.md §5.1); the server decides again.

import type { Permission, ScopedRecord } from "@vera/domain/permissions";
import { can } from "@vera/domain/permissions";
import { useSessionQuery } from "@/hooks/use-session-query";

export function useCan(): (permission: Permission, record?: ScopedRecord) => boolean {
  const { data: session } = useSessionQuery();
  return (permission, record) => session !== undefined && can(session, permission, record);
}
