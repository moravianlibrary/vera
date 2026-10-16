// The identifier types the propose settings brought, in their order, for every part of the
// propose dialog that reads, names or checks an identifier (DOC-identifiers).

import type { IdentifierTypeRule } from "@vera/domain/identifiers";
import { createContext, useContext } from "react";

export const IdentifierRulesContext = createContext<readonly IdentifierTypeRule[]>([]);

export function useIdentifierRules(): readonly IdentifierTypeRule[] {
  return useContext(IdentifierRulesContext);
}
