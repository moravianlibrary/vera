// The Identity instances people sign in through (docs/demos/shared/vera-data.js `pluginTypes`,
// kind Identity; identity.md §1): the claim each returns as the user id, the role a user first
// seen there gets, and the claims it maps to roles at every login. Users & Groups names them as
// the provenance of a mapped role.
// TODO(rrandiak): the login page's label and order, and editing all of it, arrive with Plugins
// (plan.md step 10).

import type { IdentityInstance } from "@/domain/access";

export const identityInstances: readonly IdentityInstance[] = [
  {
    id: "pi22",
    name: "MZK Keycloak",
    userIdClaim: "preferred_username",
    defaultRoleId: null,
    mappings: [
      { claim: "group mzk-staff", roleId: "staff" },
      { claim: "group mzk-curators", roleId: "curator" },
      { claim: "group mzk-digitization", roleId: "dig-curator" },
    ],
    isLocal: false,
  },
  {
    id: "pi23",
    name: "eduID.cz",
    userIdClaim: "eduPersonPrincipalName",
    defaultRoleId: "reader",
    mappings: [],
    isLocal: false,
  },
  {
    id: "pi24",
    name: "Local accounts",
    userIdClaim: "username",
    defaultRoleId: null,
    mappings: [],
    isLocal: true,
  },
];
