package cz.mzk.vera.domain.access;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

public final class Access {
  private Access() {}

  // ACCESS-suspend: a suspended person's roles are kept but give nothing.
  public static boolean isSuspended(RoleHolder user) {
    return user.suspendedAt() != null;
  }

  // ACCESS-role-ways: each role retains every way it reaches the person.
  // Each role the person holds with every way it reaches them: by hand first, then each mapping.
  public static List<HeldRole> heldRolesOf(RoleHolder user) {
    Map<String, List<RoleWay>> held = new LinkedHashMap<>();
    for (String roleId : user.handRoleIds()) {
      held.computeIfAbsent(roleId, ignored -> new ArrayList<>()).add(new RoleWay.Hand());
    }
    for (MappedRole mapped : user.mappedRoles()) {
      held.computeIfAbsent(mapped.roleId(), ignored -> new ArrayList<>())
          .add(new RoleWay.Mapped(mapped.instanceId(), mapped.claim()));
    }
    return held.entrySet().stream()
        .map(entry -> new HeldRole(entry.getKey(), entry.getValue()))
        .toList();
  }

  // ACCESS-role-ways: role IDs follow hand roles, then mapped roles, with duplicates once.
  public static List<String> heldRoleIdsOf(RoleHolder user) {
    return heldRolesOf(user).stream().map(HeldRole::roleId).toList();
  }

  // ROLE-union: grants are the union of the held roles, preserving first appearance.
  // Grants union across roles: the same permission held at several scopes stays several grants,
  // and the widest one wins where it is checked.
  public static List<Grant> grantsOf(List<Role> roles, List<String> roleIds) {
    Map<String, Grant> unique = new LinkedHashMap<>();
    for (Role role : roles) {
      if (roleIds.contains(role.id())) {
        for (Grant grant : role.grants()) {
          unique.putIfAbsent(grant.permission() + "@" + grant.scope(), grant);
        }
      }
    }
    return List.copyOf(unique.values());
  }

  // ACCESS-last-manager; ACCESS-suspend: a suspended person's roles give nothing meanwhile.
  public static <User extends RoleHolder> List<User> managersOf(List<User> users, List<Role> roles) {
    return users.stream().filter(user -> !isSuspended(user))
        .filter(user -> grantsOf(roles, heldRoleIdsOf(user)).stream()
            .anyMatch(grant -> grant.permission().equals("access.manage")))
        .toList();
  }

  // Shipped roles are lower-case words joined by hyphens.
  public static String roleNameOf(String text) {
    return text.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "-");
  }
}
