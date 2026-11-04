package cz.mzk.vera.domain.access;

import java.util.List;

public record HeldRole(String roleId, List<RoleWay> ways) {
  public HeldRole {
    ways = List.copyOf(ways);
  }
}
