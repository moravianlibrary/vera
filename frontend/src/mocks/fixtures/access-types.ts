// Server-side access records the mock resolves into a session. The client never receives them
// directly: it gets the effective grants and custody (permissions.md §1, §4).

import type { Grant } from "@/domain/permissions";

export interface Role {
  readonly id: string;
  readonly description: string;
  readonly grants: readonly Grant[];
}

// A group gives category custody and project membership, never a role.
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly categoryIds: readonly string[];
  readonly memberIds: readonly string[];
}
