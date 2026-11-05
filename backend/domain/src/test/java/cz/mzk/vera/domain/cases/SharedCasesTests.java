package cz.mzk.vera.domain.cases;

import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.access.RoleWay;
import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.entities.Batch;
import cz.mzk.vera.domain.entities.Cancellation;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.ExistingCopy;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.IterationLink;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.RegistryRecord;
import cz.mzk.vera.domain.entities.RegistryState;
import cz.mzk.vera.domain.entities.Relation;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.entities.Restriction;
import cz.mzk.vera.domain.entities.RestrictionOverride;
import cz.mzk.vera.domain.entities.Verdict;
import cz.mzk.vera.domain.entities.VerdictKind;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.domain.requests.ProposalDecision;
import cz.mzk.vera.domain.requests.RequestRow;
import cz.mzk.vera.domain.requests.Requests;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

// B3. The Java implementations run the same domain cases as TypeScript.
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
                  .sorted()
                  .toList();
    }

    List<DynamicTest> tests = new ArrayList<>();
    Set<String> discoveredFunctions = new HashSet<>();
    Set<String> unported = new java.util.TreeSet<>();
    for (Path filePath : files) {
      JsonNode file = JSON.readTree(filePath.toFile());
      JsonNode base = file.path("base");
      String function = file.path("function").asString();
      discoveredFunctions.add(function);
      Function<JsonNode, JsonNode> adapter = ADAPTERS.get(function);
      if (adapter == null) {
        unported.add(function);
        continue;
      }
      for (JsonNode testCase : file.path("cases")) {
        String name = function + ": " + testCase.path("name").asString();
        JsonNode input = mergeBase(base, testCase.path("input"));
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
    tests.add(DynamicTest.dynamicTest("not-yet-ported functions",
        () -> System.out.println("Not yet ported: " + String.join(", ", unported))));
    return tests.stream();
  }

  private static Map<String, Function<JsonNode, JsonNode>> adapters() {
    Map<String, Function<JsonNode, JsonNode>> adapters = new LinkedHashMap<>();
    adapters.put("isSuspended", input -> JSON.valueToTree(Access.isSuspended(holder(input.path("user")))));
    adapters.put("heldRolesOf", input -> heldRolesJson(Access.heldRolesOf(holder(input.path("user")))));
    adapters.put(
        "heldRoleIdsOf", input -> JSON.valueToTree(Access.heldRoleIdsOf(holder(input.path("user")))));
    adapters.put("grantsOf", input -> {
      List<Role> roles = new ArrayList<>();
      for (JsonNode roleNode : input.path("roles")) {
        List<Grant> grants = new ArrayList<>();
        for (JsonNode grantNode : roleNode.path("grants")) {
          grants.add(
              new Grant(grantNode.path("permission").asString(), nullableText(grantNode.path("scope"))));
        }
        roles.add(new Role(roleNode.path("id").asString(), grants));
      }
      List<String> roleIds = new ArrayList<>();
      input.path("roleIds").forEach(node -> roleIds.add(node.asString()));
      return JSON.valueToTree(Access.grantsOf(roles, roleIds));
    });
    adapters.put("hasPermission",
        input
        -> JSON.valueToTree(Permissions.hasPermission(
            grants(input.path("holder").path("grants")), input.path("permission").asString())));
    adapters.put("catalogEntryOf", input -> {
      Permissions.Entry entry = Permissions.catalogEntryOf(input.path("permission").asString());
      ObjectNode result = JSON.createObjectNode();
      result.put("group", entry.group());
      result.set("scopes", JSON.valueToTree(entry.scopes()));
      return result;
    });
    adapters.put("isAcceptedGrant",
        input -> JSON.valueToTree(Permissions.isAcceptedGrant(grant(input.path("grant")))));
    adapters.put("missingRequirementsOf", input -> {
      ArrayNode result = JSON.createArrayNode();
      for (Permissions.Missing missing : Permissions.missingRequirementsOf(grants(input.path("grants")))) {
        ObjectNode item = result.addObject();
        item.set("grant", JSON.valueToTree(missing.grant()));
        item.set("needs", JSON.valueToTree(missing.needs()));
      }
      return result;
    });
    adapters.put("withRequirements",
        input -> JSON.valueToTree(Permissions.withRequirements(grants(input.path("grants")))));
    adapters.put("permissionSchema",
        input -> JSON.valueToTree(Permissions.permissionIsValid(input.path("value").asString())));
    adapters.put("managersOf", input -> {
      List<RoleHolder> users = new ArrayList<>();
      input.path("users").forEach(node -> users.add(holder(node)));
      List<Role> roles = roles(input.path("roles"));
      return JSON.valueToTree(Access.managersOf(users, roles));
    });
    adapters.put("roleNameOf", input -> JSON.valueToTree(Access.roleNameOf(input.path("text").asString())));
    adapters.put(
        "validationOf", input -> JSON.valueToTree(Status.validationOf(iteration(input.path("iteration")))));
    adapters.put(
        "passesGates", input -> JSON.valueToTree(Status.passesGates(iteration(input.path("iteration")))));
    adapters.put("iterationStatusOf",
        input -> JSON.valueToTree(Status.iterationStatusOf(iteration(input.path("iteration")))));
    adapters.put("statusFootnoteOf",
        input -> JSON.valueToTree(Status.statusFootnoteOf(iteration(input.path("iteration")))));
    adapters.put("publicStatusOf",
        input
        -> JSON.valueToTree(Status.publicStatusOf(request(input.path("request")),
            input.path("iteration").isNull() ? null : iteration(input.path("iteration")))));
    adapters.put("formatRange", input -> JSON.valueToTree(formatRange(input.path("range"))));
    adapters.put("parseRange", input -> JSON.valueToTree(parseRange(input)));
    adapters.put("isWithinRange", input -> JSON.valueToTree(withinRange(input)));
    adapters.put("isReversedRange", input -> JSON.valueToTree(reversedRange(input.path("range"))));
    adapters.put("lastDaysRange",
        input
        -> JSON.valueToTree(ValueRange.lastDaysRange(day(input.path("today")), input.path("count").asInt())));
    adapters.put("monthRange", input -> JSON.valueToTree(ValueRange.monthRange(day(input.path("today")))));
    adapters.put("formatDayRange", input -> JSON.valueToTree(formatDayRange(input.path("range"))));
    adapters.put("parseDayRange", input -> JSON.valueToTree(dayRange(input.path("raw").asString())));
    adapters.put("resolveDayRange",
        input -> JSON.valueToTree(resolveDayRange(input.path("range"), day(input.path("today")))));
    adapters.put(
        "recordStatusOf", input -> JSON.valueToTree(Documents.recordStatusOf(record(input.path("record")))));
    adapters.put("publicRecordStatusOf",
        input
        -> JSON.valueToTree(
            Documents.publicRecordStatusOf(record(input.path("record")), input.path("userId").asString())));
    adapters.put("additionStateOf", input -> {
      Documents.AdditionState state = Documents.additionStateOf(record(input.path("record")));
      return state == null ? JSON.nullNode() : JSON.valueToTree(state.wireName());
    });
    adapters.put("existingCopyStateOf",
        input -> JSON.valueToTree(Documents.existingCopyStateOf(document(input.path("document")))));
    adapters.put("effectivePageCount",
        input -> JSON.valueToTree(Documents.effectivePageCount(document(input.path("document")))));
    adapters.put(
        "projectIdOf", input -> JSON.valueToTree(Documents.projectIdOf(record(input.path("record")))));
    adapters.put("batchIdOf", input -> JSON.valueToTree(Documents.batchIdOf(record(input.path("record")))));
    adapters.put(
        "rowDecisionOf", input -> JSON.valueToTree(Requests.rowDecisionOf(requests(input.path("requests")))));
    adapters.put(
        "isBeingChecked", input -> JSON.valueToTree(Requests.isBeingChecked(row(input.path("row")))));
    adapters.put(
        "isBulkApprovable", input -> JSON.valueToTree(Requests.isBulkApprovable(row(input.path("row")))));
    return Map.copyOf(adapters);
  }

  private static JsonNode mergeBase(JsonNode base, JsonNode input) {
    ObjectNode result = (ObjectNode) input.deepCopy();
    if (base.isObject()) {
      for (var field : input.properties()) {
        JsonNode value = field.getValue();
        if (field.getKey().toLowerCase().contains("iteration") && value.isObject()) {
          ObjectNode merged = (ObjectNode) base.deepCopy();
          for (var nested : value.properties()) {
            merged.set(nested.getKey(), nested.getValue());
          }
          result.set(field.getKey(), merged);
        }
      }
    }
    return result;
  }

  private static Iteration iteration(JsonNode node) {
    List<Defect> defects = new ArrayList<>();
    node.path("defects").forEach(item -> defects.add(new Defect(item.path("key").asString())));
    List<Verdict> verdicts = new ArrayList<>();
    node.path("verdicts").forEach(item -> {
      List<String> keys = new ArrayList<>();
      item.path("defectKeys").forEach(key -> keys.add(key.asString()));
      verdicts.add(new Verdict(keys, VerdictKind.valueOf(item.path("verdict").asString())));
    });
    JsonNode restriction = node.path("restriction");
    JsonNode override = node.path("restrictionOverride");
    JsonNode cancellation = node.path("cancellation");
    return new Iteration(text(node, "id"), text(node, "documentId"), 1, text(node, "requestId"),
        text(node, "categoryId"), nullableText(node.path("projectId")),
        Progress.valueOf(node.path("progress").asString("Published")),
        restriction.isNull() ? null : new Restriction(text(restriction, "rule")),
        override.isNull() ? null : new RestrictionOverride(text(override, "note")),
        cancellation.isNull() ? null
                              : new Cancellation(CancellationCause.valueOf(text(cancellation, "cause"))),
        defects, verdicts);
  }

  private static Request request(JsonNode node) {
    return new Request(text(node, "id"), text(node, "documentId"), text(node, "requesterId"),
        text(node, "at"), nullableText(node.path("reason")), text(node, "batchId"),
        nullableText(node.path("projectId")), Decision.valueOf(node.path("decision").asString("Pending")),
        iterationLink(node.path("iteration")), nullableText(node.path("tracksIterationId")),
        existingCopies(node.path("existingCopies")), nullableText(node.path("checkedAt")),
        node.path("isAfterProjectApproval").asBoolean());
  }

  private static IterationLink iterationLink(JsonNode node) {
    if (node.isNull() || node.isMissingNode()) {
      return null;
    }
    return new IterationLink(Relation.valueOf(node.path("relation").asString()), text(node, "id"));
  }

  private static List<ExistingCopy> existingCopies(JsonNode nodes) {
    List<ExistingCopy> result = new ArrayList<>();
    nodes.forEach(node
        -> result.add(new ExistingCopy(text(node, "source"),
            RegistryState.valueOf(node.path("state").asString("NotFound")), nullableText(node.path("link")),
            nullableText(node.path("iterationId")))));
    return result;
  }

  private static List<Request> requests(JsonNode nodes) {
    List<Request> result = new ArrayList<>();
    nodes.forEach(node -> result.add(request(node)));
    return result;
  }

  private static Document document(JsonNode node) {
    List<PageSource> pages = new ArrayList<>();
    node.path("pageSources")
        .forEach(item
            -> pages.add(
                new PageSource(text(item, "source"), item.path("tier").asInt(), item.path("value").asInt())));
    List<RegistryRecord> registries = new ArrayList<>();
    node.path("registryRecords")
        .forEach(item
            -> registries.add(new RegistryRecord(
                text(item, "registry"), RegistryState.valueOf(item.path("state").asString()))));
    JsonNode unit = node.path("unit");
    return new Document(text(node, "id"), text(node, "catalogId"),
        unit.isNull() || unit.isMissingNode() ? null : text(unit, "value"), pages, registries);
  }

  private static DocumentRecord record(JsonNode input) {
    List<Iteration> iterations = new ArrayList<>();
    input.path("iterations").forEach(item -> iterations.add(iteration(item)));
    return new DocumentRecord(document(input.path("document")), iterations, requests(input.path("requests")));
  }

  private static RequestRow row(JsonNode input) {
    return new RequestRow(record(input.path("record")),
        ProposalDecision.valueOf(input.path("decision").asString()), List.of(), null);
  }

  private static String text(JsonNode node, String field) {
    return node.path(field).asString("");
  }

  private static LocalDate day(JsonNode node) {
    return Instant.parse(node.asString()).atZone(ZoneId.of("Europe/Prague")).toLocalDate();
  }

  private static String formatRange(JsonNode node) {
    if (node.isMissingNode() || node.isNull()) {
      return null;
    }
    return ValueRange.formatRange(new Range<>(value(node.path("from")), value(node.path("to"))));
  }

  private static Object parseRange(JsonNode input) {
    String raw = text(input, "raw");
    boolean isDay = input.path("kind").asString().equals("day");
    Range<?> range = isDay ? ValueRange.parseRange(raw, ValueRange::parseDay)
                           : ValueRange.parseRange(raw, ValueRange::parseCount);
    if (range == null) {
      return null;
    }
    ObjectNode out = JSON.createObjectNode();
    if (range.from() != null) {
      out.set("from",
          isDay ? JSON.valueToTree(range.from().toString())
                : JSON.valueToTree(((Number) range.from()).intValue()));
    }
    if (range.to() != null) {
      out.set("to",
          isDay ? JSON.valueToTree(range.to().toString())
                : JSON.valueToTree(((Number) range.to()).intValue()));
    }
    return out;
  }

  private static boolean withinRange(JsonNode input) {
    JsonNode range = input.path("range");
    JsonNode value = input.path("value");
    if (value.isNumber()) {
      return ValueRange.isWithinRange(
          value.asLong(), new Range<>(number(range.path("from")), number(range.path("to"))));
    }
    return ValueRange.isWithinRange(
        value.asString(), new Range<>(nullableString(range.path("from")), nullableString(range.path("to"))));
  }

  private static boolean reversedRange(JsonNode range) {
    if (range.path("from").isNumber()) {
      return ValueRange.isReversedRange(new Range<>(number(range.path("from")), number(range.path("to"))));
    }
    return ValueRange.isReversedRange(
        new Range<>(nullableString(range.path("from")), nullableString(range.path("to"))));
  }

  private static Object dayRange(String raw) {
    DayRange range = ValueRange.parseDayRange(raw);
    if (range == null) {
      return null;
    }
    if (range.preset() != null) {
      return Map.of("preset", range.preset().wireName());
    }
    ObjectNode result = JSON.createObjectNode();
    if (range.range().from() != null) {
      result.put("from", range.range().from().toString());
    }
    if (range.range().to() != null) {
      result.put("to", range.range().to().toString());
    }
    return result;
  }

  private static String formatDayRange(JsonNode range) {
    DayRange value;
    if (range.has("preset")) {
      value = new DayRange(null, ValueRange.DayPreset.of(range.path("preset").asString()));
    } else {
      value = new DayRange(new Range<>(nullableDay(range.path("from")), nullableDay(range.path("to"))), null);
    }
    return ValueRange.formatDayRange(value);
  }

  private static Object value(JsonNode node) {
    if (node.isMissingNode() || node.isNull()) {
      return null;
    }
    return node.isNumber() ? node.numberValue() : node.asString();
  }

  private static Long number(JsonNode node) {
    return node.isMissingNode() || node.isNull() ? null : node.asLong();
  }

  private static String nullableString(JsonNode node) {
    return node.isMissingNode() || node.isNull() ? null : node.asString();
  }

  private static LocalDate nullableDay(JsonNode node) {
    return node.isMissingNode() || node.isNull() ? null : ValueRange.parseDay(node.asString());
  }

  private static Object resolveDayRange(JsonNode range, LocalDate today) {
    DayRange dayRange;
    if (range.has("preset")) {
      dayRange = new DayRange(null, ValueRange.DayPreset.of(range.path("preset").asString()));
    } else {
      dayRange =
          new DayRange(new Range<>(nullableDay(range.path("from")), nullableDay(range.path("to"))), null);
    }
    Range<String> resolved = ValueRange.resolveDayRange(dayRange, today);
    ObjectNode result = JSON.createObjectNode();
    if (resolved.from() != null) {
      result.put("from", resolved.from());
    }
    if (resolved.to() != null) {
      result.put("to", resolved.to());
    }
    return result;
  }

  private static List<Role> roles(JsonNode nodes) {
    List<Role> roles = new ArrayList<>();
    for (JsonNode node : nodes) {
      roles.add(new Role(node.path("id").asString(), grants(node.path("grants"))));
    }
    return roles;
  }

  private static List<Grant> grants(JsonNode nodes) {
    List<Grant> grants = new ArrayList<>();
    for (JsonNode node : nodes) {
      grants.add(grant(node));
    }
    return grants;
  }

  private static Grant grant(JsonNode node) {
    return new Grant(node.path("permission").asString(), nullableText(node.path("scope")));
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
