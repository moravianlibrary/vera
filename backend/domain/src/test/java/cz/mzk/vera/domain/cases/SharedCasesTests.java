package cz.mzk.vera.domain.cases;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.access.RoleWay;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

class SharedCasesTests {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final Map<String, Function<JsonNode, JsonNode>> ADAPTERS = adapters();

  @TestFactory
  Stream<DynamicTest> sharedCases() throws IOException {
    String casesDirectory = System.getProperty("vera.domain.cases");
    if (casesDirectory == null) {
      throw new IllegalStateException("Gradle must set vera.domain.cases");
    }
    Path root = Path.of(casesDirectory);
    List<Path> files;
    try (Stream<Path> paths = Files.walk(root)) {
      files = paths.filter(path -> path.toString().endsWith(".json"))
          .filter(path -> !path.getFileName().toString().equals("case-file.schema.json"))
          .sorted().toList();
    }

    List<DynamicTest> tests = new ArrayList<>();
    Set<String> discoveredFunctions = new HashSet<>();
    Set<String> unported = new java.util.TreeSet<>();
    for (Path filePath : files) {
      JsonNode file = JSON.readTree(filePath.toFile());
      String function = file.path("function").asString();
      discoveredFunctions.add(function);
      Function<JsonNode, JsonNode> adapter = ADAPTERS.get(function);
      if (adapter == null) {
        unported.add(function);
        continue;
      }
      for (JsonNode testCase : file.path("cases")) {
        String name = function + ": " + testCase.path("name").asString();
        JsonNode input = testCase.path("input");
        JsonNode expected = testCase.path("expected");
        tests.add(DynamicTest.dynamicTest(name, () -> {
          JsonNode actual = adapter.apply(input);
          org.junit.jupiter.api.Assertions.assertEquals(expected, actual);
        }));
      }
    }
    for (String function : ADAPTERS.keySet()) {
      if (!discoveredFunctions.contains(function)) {
        tests.add(DynamicTest.dynamicTest("registered function has a case file: " + function,
            () -> org.junit.jupiter.api.Assertions.fail("No case file for registered function " + function)));
      }
    }
    tests.add(DynamicTest.dynamicTest("not-yet-ported functions", () ->
        System.out.println("Not yet ported: " + String.join(", ", unported))));
    return tests.stream();
  }

  private static Map<String, Function<JsonNode, JsonNode>> adapters() {
    Map<String, Function<JsonNode, JsonNode>> adapters = new LinkedHashMap<>();
    adapters.put("isSuspended", input -> JSON.valueToTree(Access.isSuspended(holder(input.path("user")))));
    adapters.put("heldRolesOf", input -> heldRolesJson(Access.heldRolesOf(holder(input.path("user")))));
    adapters.put("heldRoleIdsOf", input -> JSON.valueToTree(Access.heldRoleIdsOf(holder(input.path("user")))));
    adapters.put("grantsOf", input -> {
      List<Role> roles = new ArrayList<>();
      for (JsonNode roleNode : input.path("roles")) {
        List<Grant> grants = new ArrayList<>();
        for (JsonNode grantNode : roleNode.path("grants")) {
          grants.add(new Grant(grantNode.path("permission").asString(), nullableText(grantNode.path("scope"))));
        }
        roles.add(new Role(roleNode.path("id").asString(), grants));
      }
      List<String> roleIds = new ArrayList<>();
      input.path("roleIds").forEach(node -> roleIds.add(node.asString()));
      return JSON.valueToTree(Access.grantsOf(roles, roleIds));
    });
    return Map.copyOf(adapters);
  }

  private static RoleHolder holder(JsonNode node) {
    List<String> handRoleIds = new ArrayList<>();
    node.path("handRoleIds").forEach(role -> handRoleIds.add(role.asString()));
    List<MappedRole> mappedRoles = new ArrayList<>();
    for (JsonNode mapped : node.path("mappedRoles")) {
      mappedRoles.add(new MappedRole(mapped.path("roleId").asString(), mapped.path("instanceId").asString(),
          mapped.path("claim").asString()));
    }
    return new RoleHolder(handRoleIds, mappedRoles, nullableText(node.path("suspendedAt")));
  }

  private static String nullableText(JsonNode node) {
    return node.isMissingNode() || node.isNull() ? null : node.asString();
  }

  private static ArrayNode heldRolesJson(List<cz.mzk.vera.domain.access.HeldRole> heldRoles) {
    ArrayNode result = JSON.createArrayNode();
    for (var held : heldRoles) {
      ObjectNode role = result.addObject();
      role.put("roleId", held.roleId());
      ArrayNode ways = role.putArray("ways");
      for (RoleWay way : held.ways()) {
        ObjectNode wayNode = ways.addObject();
        if (way instanceof RoleWay.Hand) {
          wayNode.put("by", "hand");
        } else if (way instanceof RoleWay.Mapped mapped) {
          wayNode.put("by", "mapped");
          wayNode.put("instanceId", mapped.instanceId());
          wayNode.put("claim", mapped.claim());
        }
      }
    }
    return result;
  }
}
