package cz.mzk.vera.domain.access;

public sealed interface RoleWay permits RoleWay.Hand, RoleWay.Mapped {
  record Hand() implements RoleWay {}

  record Mapped(String instanceId, String claim) implements RoleWay {}
}
