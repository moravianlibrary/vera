package cz.mzk.vera.domain.access;

import java.util.List;

public record RoleHolder(List<String> handRoleIds, List<MappedRole> mappedRoles, String suspendedAt) {
  public RoleHolder {
    handRoleIds = List.copyOf(handRoleIds);
    mappedRoles = List.copyOf(mappedRoles);
  }
}
