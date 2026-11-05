package cz.mzk.vera.domain.permissions;

import cz.mzk.vera.domain.access.Grant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

// The permissions and scopes a role can grant, and the other grants each one needs (PERM-grant,
// PERM-requires; PERM-property-edit).
public final class Permissions {
  public static final List<String> KEYS = List.of(
      "request.create",
      "request.read_mine",
      "request.withdraw_own",
      "request.read",
      "request.decide",
      "request.read_ingest",
      "request.retry",
      "request.read_payload",
      "project.read",
      "project.create",
      "project.edit",
      "project.manage_members",
      "project.delete",
      "project.decide",
      "iteration.read",
      "iteration.recheck",
      "iteration.classify",
      "validation.approve",
      "validation.deny",
      "validation.revoke",
      "restriction.overrule",
      "iteration.cancel",
      "iteration.resume",
      "iteration.publish",
      "watch",
      "watchlist.manage_system",
      "list.read",
      "list.create",
      "list.edit",
      "list.delete",
      "intention.read",
      "intention.edit",
      "intention.repeat",
      "mix.read",
      "mix.edit",
      "mix.manage",
      "category.read",
      "category.edit",
      "category.grant_custody",
      "task.read_own",
      "task.read",
      "task.cancel",
      "task.schedule",
      "plugin.read",
      "plugin.configure",
      "plugin.upload_code",
      "plugin.run",
      "hook.read",
      "hook.configure",
      "property.define",
      "access.read",
      "access.manage");

  private static final List<String> OWN_ONLY = List.of("own");
  private static final List<String> OWN_OR_PROJECT = List.of("own", "project");
  private static final List<String> CUSTODY_OR_ANY = List.of("custody", "any");
  private static final List<String> READ_SCOPES = List.of("custody", "project", "any");
  private static final List<String> ANY_ONLY = List.of("any");
  private static final List<String> MANAGED_OR_ANY = List.of("managed", "any");
  private static final List<String> PROJECT_OR_ANY = List.of("project", "any");
  public static final List<String> PERMISSION_GROUPS = List.of(
      "Requests", "Iterations", "Planning", "Categories", "Watchlists", "Properties",
      "Administration");

  private static final Map<String, Entry> CATALOG = catalog();
  private static final Map<String, List<Requirement>> REQUIRES = requirements();

  private Permissions() {}

  public record Entry(String group, List<String> scopes) {}
  public record Requirement(String permission, String at) {}
  public record Missing(Grant grant, Grant needs) {}

  public static boolean hasPermission(List<Grant> grants, String permission) {
    return grants.stream().anyMatch(grant -> grant.permission().equals(permission));
  }

  // PERM-property-edit: accepted at `any` only.
  public static boolean permissionIsValid(String permission) {
    return CATALOG.containsKey(permission)
        || permission.matches("property\\.[a-z][a-z0-9_]*\\.edit");
  }

  public static Entry catalogEntryOf(String permission) {
    if (permissionIsPropertyEdit(permission)) {
      return new Entry("Properties", ANY_ONLY);
    }
    Entry entry = CATALOG.get(permission);
    if (entry == null) {
      throw new IllegalArgumentException("Unknown permission: " + permission);
    }
    return entry;
  }

  // PERM-accepted-scopes: own has a null Grant scope; every other accepted value is literal.
  public static boolean isAcceptedGrant(Grant grant) {
    Entry entry = catalogEntryOf(grant.permission());
    return entry.scopes().contains(grant.scope() == null ? "own" : grant.scope());
  }

  // PERM-self-scoped: own-only permissions take no scope selection.
  public static boolean isSelfScoped(String permission) {
    return catalogEntryOf(permission).scopes().equals(OWN_ONLY);
  }

  public static List<Requirement> requirementsOf(String permission) {
    if (permissionIsPropertyEdit(permission)) {
      return List.of(new Requirement("iteration.read", "any"));
    }
    return REQUIRES.getOrDefault(permission, List.of());
  }

  // A permission another needs (PERM-requires). Held at a scope covering the grant's by default;
  // `any` where the need is only met everywhere; `held` where any scope will do, as creating a
  // project reaches no project yet. A self-scoped need is met by holding it.
  // Whether a grant at `held` reaches everything one at `scope` does: `any` covers every scope,
  // `project` covers `managed`, as a project's manager is on it, and every scope covers `own`.
  public static boolean coversScope(String held, String scope) {
    return "any".equals(held) || Objects.equals(held, scope) || scope == null
        || ("project".equals(held) && "managed".equals(scope));
  }

  // PERM-requires: choose the narrowest accepted scope that covers the grant being edited.
  public static String requiredScopeOf(Requirement requirement, String scope) {
    Entry entry = catalogEntryOf(requirement.permission());
    if (isSelfScoped(requirement.permission())) {
      return null;
    }
    if ("any".equals(requirement.at())) {
      return "any";
    }
    for (String candidate : entry.scopes()) {
      String value = candidate.equals("own") ? null : candidate;
      if ("held".equals(requirement.at()) || coversScope(value, scope)) {
        return value;
      }
    }
    return "any";
  }

  // PERM-requires: report every requirement a grant set does not meet.
  public static List<Missing> missingRequirementsOf(List<Grant> grants) {
    List<Missing> missing = new ArrayList<>();
    for (Grant grant : grants) {
      for (Requirement requirement : requirementsOf(grant.permission())) {
        Grant held = grants.stream()
            .filter(candidate -> candidate.permission().equals(requirement.permission()))
            .findFirst()
            .orElse(null);
        boolean met = held != null && (isSelfScoped(requirement.permission())
            || "held".equals(requirement.at())
            || coversScope(held.scope(), "any".equals(requirement.at()) ? "any" : grant.scope()));
        if (!met) {
          missing.add(new Missing(grant,
              new Grant(requirement.permission(), requiredScopeOf(requirement, grant.scope()))));
        }
      }
    }
    return List.copyOf(missing);
  }

  // The grants with every need added or widened, transitively: what the role editor ticks with a
  // permission (PERM-requires).
  public static List<Grant> withRequirements(List<Grant> grants) {
    List<Grant> next = new ArrayList<>(grants);
    while (true) {
      List<Missing> missing = missingRequirementsOf(next);
      if (missing.isEmpty()) {
        return List.copyOf(next);
      }
      Grant need = missing.getFirst().needs();
      String requiredPermission = need.permission();
      Grant held = next.stream()
          .filter(candidate -> candidate.permission().equals(requiredPermission))
          .findFirst()
          .orElse(null);
      if (held != null) {
        need = new Grant(need.permission(), "any");
      }
      Grant selected = need;
      next.removeIf(candidate -> candidate == held);
      next.add(selected);
    }
  }

  private static boolean permissionIsPropertyEdit(String permission) {
    return permission.matches("property\\.[a-z][a-z0-9_]*\\.edit");
  }

  private static Map<String, Entry> catalog() {
    Map<String, Entry> entries = new LinkedHashMap<>();
    entries.put("request.create", new Entry("Requests", OWN_ONLY));
    // VIEW-documents-audience: one's own asks, or also those made into one's projects.
    entries.put("request.read_mine", new Entry("Requests", OWN_OR_PROJECT));
    entries.put("request.withdraw_own", new Entry("Requests", OWN_ONLY));
    entries.put("request.read", new Entry("Requests", READ_SCOPES));
    entries.put("request.decide", new Entry("Requests", CUSTODY_OR_ANY));
    entries.put("request.read_ingest", new Entry("Requests", CUSTODY_OR_ANY));
    entries.put("request.retry", new Entry("Requests", CUSTODY_OR_ANY));
    entries.put("request.read_payload", new Entry("Requests", ANY_ONLY));
    entries.put("project.read", new Entry("Requests", PROJECT_OR_ANY));
    entries.put("project.create", new Entry("Requests", ANY_ONLY));
    entries.put("project.edit", new Entry("Requests", MANAGED_OR_ANY));
    entries.put("project.manage_members", new Entry("Requests", MANAGED_OR_ANY));
    entries.put("project.delete", new Entry("Requests", MANAGED_OR_ANY));
    entries.put("project.decide", new Entry("Requests", ANY_ONLY));
    entries.put("iteration.read", new Entry("Iterations", READ_SCOPES));
    entries.put("iteration.recheck", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("iteration.classify", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("validation.approve", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("validation.deny", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("validation.revoke", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("restriction.overrule", new Entry("Iterations", ANY_ONLY));
    entries.put("iteration.cancel", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("iteration.resume", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("iteration.publish", new Entry("Iterations", CUSTODY_OR_ANY));
    entries.put("list.read", new Entry("Planning", READ_SCOPES));
    entries.put("list.create", new Entry("Planning", ANY_ONLY));
    entries.put("list.edit", new Entry("Planning", ANY_ONLY));
    entries.put("list.delete", new Entry("Planning", ANY_ONLY));
    entries.put("intention.read", new Entry("Planning", PROJECT_OR_ANY));
    entries.put("intention.edit", new Entry("Planning", PROJECT_OR_ANY));
    entries.put("intention.repeat", new Entry("Planning", ANY_ONLY));
    entries.put("mix.read", new Entry("Planning", ANY_ONLY));
    entries.put("mix.edit", new Entry("Planning", ANY_ONLY));
    entries.put("mix.manage", new Entry("Planning", ANY_ONLY));
    entries.put("category.read", new Entry("Categories", CUSTODY_OR_ANY));
    entries.put("category.edit", new Entry("Categories", CUSTODY_OR_ANY));
    entries.put("category.grant_custody", new Entry("Categories", CUSTODY_OR_ANY));
    entries.put("watch", new Entry("Watchlists", OWN_ONLY));
    entries.put("watchlist.manage_system", new Entry("Watchlists", ANY_ONLY));
    entries.put("task.read_own", new Entry("Administration", OWN_ONLY));
    entries.put("task.read", new Entry("Administration", ANY_ONLY));
    entries.put("task.cancel", new Entry("Administration", ANY_ONLY));
    entries.put("task.schedule", new Entry("Administration", ANY_ONLY));
    entries.put("plugin.read", new Entry("Administration", ANY_ONLY));
    entries.put("plugin.configure", new Entry("Administration", ANY_ONLY));
    entries.put("plugin.upload_code", new Entry("Administration", ANY_ONLY));
    entries.put("plugin.run", new Entry("Administration", ANY_ONLY));
    entries.put("hook.read", new Entry("Administration", ANY_ONLY));
    entries.put("hook.configure", new Entry("Administration", ANY_ONLY));
    entries.put("property.define", new Entry("Administration", ANY_ONLY));
    entries.put("access.read", new Entry("Administration", ANY_ONLY));
    entries.put("access.manage", new Entry("Administration", ANY_ONLY));
    return Map.copyOf(entries);
  }

  private static Map<String, List<Requirement>> requirements() {
    Map<String, List<Requirement>> result = new LinkedHashMap<>();
    needs(result, "request.create", "request.read_mine");
    needs(result, "request.withdraw_own", "request.read_mine");
    needs(result, "request.decide", "request.read");
    needs(result, "request.read_ingest", "iteration.read");
    needs(result, "request.retry", "request.read_ingest");
    needs(result, "request.read_payload", "request.read_ingest");
    needs(result, "project.edit", "project.read");
    needs(result, "project.manage_members", "project.read");
    needs(result, "project.delete", "project.read");
    needsAtHeld(result, "project.create", "project.read");
    needsAtAny(result, "project.decide", "project.read");
    needs(result, "iteration.recheck", "iteration.read");
    needs(result, "iteration.classify", "iteration.read");
    needs(result, "validation.approve", "iteration.read");
    needs(result, "validation.deny", "iteration.read");
    needs(result, "validation.revoke", "iteration.read");
    needs(result, "restriction.overrule", "iteration.read");
    needs(result, "iteration.cancel", "iteration.read");
    needs(result, "iteration.resume", "iteration.read");
    needs(result, "iteration.publish", "iteration.read");
    needs(result, "list.read", "iteration.read");
    needsAtAny(result, "list.create", "list.read", "iteration.read");
    needsAtAny(result, "list.edit", "list.read", "iteration.read");
    needsAtAny(result, "list.delete", "list.read", "iteration.read");
    needs(result, "intention.edit", "intention.read", "mix.read");
    needsAtAny(result, "intention.repeat", "intention.edit");
    needs(result, "mix.edit", "mix.read");
    needs(result, "mix.manage", "mix.edit");
    needs(result, "category.edit", "category.read");
    needs(result, "category.grant_custody", "category.read");
    // My Documents watchlists are built over one's own reach: holding it at all will do.
    needs(result, "watchlist.manage_system", "watch");
    needs(result, "watchlist.manage_system", "request.read_mine");
    needsAtAny(result, "watchlist.manage_system", "iteration.read");
    needs(result, "task.cancel", "task.read");
    needs(result, "task.schedule", "task.read");
    needs(result, "plugin.configure", "plugin.read");
    needs(result, "plugin.run", "plugin.read");
    needs(result, "plugin.upload_code", "plugin.configure");
    needs(result, "hook.configure", "hook.read");
    needs(result, "access.manage", "access.read");
    return Map.copyOf(result);
  }

  private static void needs(Map<String, List<Requirement>> requirements, String permission,
      String... dependencies) {
    addRequirements(requirements, permission, null, dependencies);
  }

  private static void needsAtAny(Map<String, List<Requirement>> requirements, String permission,
      String... dependencies) {
    addRequirements(requirements, permission, "any", dependencies);
  }

  private static void needsAtHeld(Map<String, List<Requirement>> requirements, String permission,
      String... dependencies) {
    addRequirements(requirements, permission, "held", dependencies);
  }

  private static void addRequirements(Map<String, List<Requirement>> requirements,
      String permission, String at, String... dependencies) {
    List<Requirement> list = new ArrayList<>(requirements.getOrDefault(permission, List.of()));
    for (String dependency : dependencies) {
      list.add(new Requirement(dependency, at));
    }
    requirements.put(permission, List.copyOf(list));
  }
}
