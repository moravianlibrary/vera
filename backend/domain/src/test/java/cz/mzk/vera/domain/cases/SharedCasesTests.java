package cz.mzk.vera.domain.cases;

import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.access.RoleWay;
import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.mixes.Mixes;
import cz.mzk.vera.domain.projects.Projects;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.domain.validations.Validations;
import cz.mzk.vera.domain.entities.Batch;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Cancellation;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.ExistingCopy;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.entities.IntentionFunding;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Distribution;
import cz.mzk.vera.domain.entities.IterationLink;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.PropertyCondition;
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
import cz.mzk.vera.domain.tasks.Tasks;
import cz.mzk.vera.domain.schedules.Schedules;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
    adapters.put("categoryPathOf", input -> JSON.valueToTree(Categories.categoryPathOf(categories(input.path("categories")), text(input, "categoryId"))));
    adapters.put("categoryLineageOf", input -> JSON.valueToTree(Categories.lineageOf(categories(input.path("categories")), text(input, "categoryId"))));
    adapters.put("leafCategoriesOf", input -> JSON.valueToTree(Categories.leavesOf(categories(input.path("categories")))));
    adapters.put("isInSubtree", input -> JSON.valueToTree(Categories.isInSubtree(categories(input.path("categories")), text(input, "categoryId"), text(input, "topId"))));
    adapters.put("searchedCategoriesOf", input -> {
      var result = Categories.searchedCategoriesOf(categories(input.path("categories")), text(input, "search"));
      return result == null ? JSON.nullNode() : JSON.valueToTree(result.stream().sorted().toList());
    });
    adapters.put("isOutsideScope", input -> JSON.valueToTree(Categories.isOutsideScope(categories(input.path("categories")), nullableText(input.path("scopeCategoryId")), nullableText(input.path("categoryId")))));
    adapters.put("custodyReachOf", input -> JSON.valueToTree(Categories.custodyReachOf(categories(input.path("categories")), custodyHolders(input.path("holders")), text(input, "categoryId"))));
    adapters.put("unheldCategoriesOf", input -> JSON.valueToTree(Categories.unheldCategoriesOf(categories(input.path("categories")), custodyHolders(input.path("holders")))));
    adapters.put("scopeOfCategory", input -> {
      var scope = Categories.scopeOfCategory(categories(input.path("categories")), nullableText(input.path("categoryId")));
      ObjectNode result = JSON.createObjectNode(); result.put("kind", scope.kind());
      if (scope.kind().equals("category")) result.set("categoryPathIds", JSON.valueToTree(scope.categoryPathIds()));
      return result;
    });
    adapters.put("placesFor", input -> JSON.valueToTree(Categories.placesFor(categories(input.path("categories")), text(input, "categoryId"), id -> input.path("documentsByCategory").path(id).asBoolean())));
    adapters.put("isNameTaken", input -> JSON.valueToTree(Categories.isNameTaken(categories(input.path("categories")), nullableText(input.path("parentId")), text(input, "name"), nullableText(input.path("exceptId")))));
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
    adapters.put("canCancelRun", input -> JSON.valueToTree(Tasks.canCancelRun(
        taskSession(input), taskRun(input))));
    adapters.put("canRunAgain", input -> JSON.valueToTree(Tasks.canRunAgain(
        taskSession(input), taskRun(input))));
    adapters.put("repeatCadenceOf", input -> JSON.valueToTree(
        Schedules.repeatCadenceOf(text(input, "every"))));
    adapters.put("nextOccurrenceOf", input -> {
      String after = text(input, "after");
      Instant moment = Instant.parse(after.endsWith("Z") ? after : after + "Z");
      @SuppressWarnings("unchecked")
      Map<String, Object> cadence = (Map<String, Object>) generic(input.path("cadence"));
      Instant next = Schedules.nextOccurrenceOf(cadence, moment);
      return next == null ? JSON.nullNode() : JSON.valueToTree(
          DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'")
              .withZone(ZoneOffset.UTC).format(next));
    });
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
    adapters.put("isReclassifiable", input -> JSON.valueToTree(Iterations.isReclassifiable(iteration(input.path("iteration")))));
    adapters.put("isPublishable", input -> JSON.valueToTree(Iterations.isPublishable(iteration(input.path("iteration")))));
    adapters.put("isCancellable", input -> JSON.valueToTree(Iterations.isCancellable(iteration(input.path("iteration")))));
    adapters.put("isResumable", input -> JSON.valueToTree(Iterations.isResumable(iteration(input.path("iteration")))));
    adapters.put("isOverrulable", input -> JSON.valueToTree(Iterations.isOverrulable(iteration(input.path("iteration")))));
    adapters.put("progressAfterGates", input -> JSON.valueToTree(Iterations.progressAfterGates(iteration(input.path("iteration")))));
    adapters.put("scopeOfIteration", input -> JSON.valueToTree(Iterations.scopeOfIteration(categories(input.path("categories")), input.path("categoryId").asString())));
    adapters.put("reviewStateOf", input -> JSON.valueToTree(Validations.reviewStateOf(iteration(input.path("iteration")))));
    adapters.put("waitingSinceOf", input -> JSON.valueToTree(Validations.waitingSinceOf(iteration(input.path("iteration")))));
    adapters.put("defectsToRuleOn", input -> JSON.valueToTree(Validations.defectsToRuleOn(iteration(input.path("iteration")))));
    adapters.put("acceptedDefectsOf", input -> JSON.valueToTree(Validations.acceptedDefectsOf(iteration(input.path("iteration")))));
    adapters.put("deniedDefectsOf", input -> JSON.valueToTree(Validations.deniedDefectsOf(iteration(input.path("iteration")))));
    adapters.put("isFoundAfterScan", input -> JSON.valueToTree(Validations.isFoundAfterScan(iteration(input.path("iteration")))));
    adapters.put("listStateOf", input -> JSON.valueToTree(Lists.listStateOf(digitizationList(input.path("list")), text(input, "today"))));
    adapters.put("isOverdue", input -> JSON.valueToTree(Lists.isOverdue(digitizationList(input.path("list")), text(input, "today"))));
    adapters.put("progressOnList", input -> JSON.valueToTree(Lists.progressOnList(digitizationList(input.path("list")), text(input, "today"))));
    adapters.put("isScanned", input -> JSON.valueToTree(Lists.isScanned(iteration(input.path("iteration")))));
    adapters.put("memberBlockerOf", input -> JSON.valueToTree(Lists.memberBlockerOf(iteration(input.path("iteration")))));
    adapters.put("isInPool", input -> JSON.valueToTree(Lists.isInPool(iteration(input.path("iteration")))));
    adapters.put("periodOf", input -> JSON.valueToTree(Projects.periodOf(text(input.path("project"), "startsOn"), text(input.path("project"), "endsOn"), text(input, "today"))));
    adapters.put("timeElapsedOf", input -> numberNode(Projects.timeElapsedOf(text(input.path("project"), "startsOn"), text(input.path("project"), "endsOn"), text(input, "today"))));
    adapters.put("daysUntil", input -> numberNode(Projects.daysUntil(text(input, "calendarDate"), text(input, "today"))));
    adapters.put("isProjectMember", input -> JSON.valueToTree(Projects.isProjectMember(projectMembers(input.path("project")), text(input, "userId"), strings(input.path("groupIds")))));
    adapters.put("scopeOfProject", input -> JSON.valueToTree(Projects.scopeOfProject(projectMembers(input.path("project")))));
    adapters.put("mayBeEnteredByHand", input -> JSON.valueToTree(Properties.mayBeEnteredByHand(text(input.path("definition"), "key"), input.path("definition").path("isCatalogFact").asBoolean())));
    adapters.put("isActiveCondition", input -> JSON.valueToTree(Properties.isActiveCondition(propertyCondition(input.path("condition")))));
    adapters.put("meetsCondition", input -> JSON.valueToTree(Properties.meetsCondition(propertyCondition(input.path("condition")), generic(input.path("value")), text(input, "today"))));
    adapters.put("textSummaryOf", input -> JSON.valueToTree(Properties.textSummaryOf(propertyCondition(input.path("condition")))));
    adapters.put("withTextCondition", input -> propertyConditionJson(Properties.withTextCondition(propertyCondition(input.path("condition")), text(input, "match"), text(input, "text"))));
    adapters.put("facetValueOf", input -> JSON.valueToTree(Properties.facetValueOf(generic(input.path("value")))));
    adapters.put("editPermissionOf", input -> JSON.valueToTree(Properties.editPermissionOf(text(input, "key"))));
    adapters.put("propertyKeyOfPermission", input -> JSON.valueToTree(Properties.propertyKeyOfPermission(text(input, "permission"))));
    adapters.put("valuesOf", input -> JSON.valueToTree(Properties.valuesOf(propertyValues(input.path("properties")), text(input, "key"))));
    adapters.put("sourcesByTierOf", input -> sourcesJson(Properties.sourcesByTierOf(propertySources(input.path("values").path("sources")))));
    adapters.put("valueInUseOf", input -> sourceJson(Properties.valueInUseOf(propertySources(input.path("values").path("sources")))));
    adapters.put("valueInUseAt", input -> sourceJson(Properties.valueInUseAt(propertySources(input.path("values").path("sources")), text(input, "at"))));
    adapters.put("isValueOf", input -> JSON.valueToTree(Properties.isValueOf(propertyDefinition(input.path("definition")), generic(input.path("value")))));
    adapters.put("formatPropertyValue", input -> JSON.valueToTree(Properties.formatPropertyValue(propertyDefinition(input.path("definition")), generic(input.path("value")))));
    adapters.put("defectNameOf", input -> JSON.valueToTree(Validations.defectNameOf(defect(input.path("defect")), id -> input.path("instanceNames").path(id).asString(id))));
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
    adapters.put("intentionTimeElapsedOf", input -> JSON.valueToTree(Intentions.intentionTimeElapsedOf(
        text(input.path("intention"), "countsFrom"), nullableText(input.path("intention").path("endsOn")),
        text(input, "today"))));
    adapters.put("pagesPerWeekNeededOf", input -> JSON.valueToTree(Intentions.pagesPerWeekNeededOf(
        intention(input.path("input").path("intention")), input.path("input").path("deliveredPages").asInt(), text(input.path("input"), "today"))));
    adapters.put("catchUpPagesOf", input -> JSON.valueToTree(Intentions.catchUpPagesOf(
        intention(input.path("input").path("intention")), input.path("input").path("plannedPages").asInt(),
        input.path("input").path("deliveredPages").asInt(), text(input.path("input"), "today"))));
    adapters.put("nextPeriodStartOf", input -> JSON.valueToTree(Intentions.nextPeriodStartOf(
        Intentions.RepeatPeriod.valueOf(text(input, "period")), LocalDate.parse(text(input, "today"))).toString()));
    adapters.put("scopeOfIntention", input -> JSON.valueToTree(Intentions.scopeOfIntention(funding(input.path("intention").path("funding")), projectScopes(input.path("projects")))));
    adapters.put("mixReadingOf", input -> {
      List<Iteration> all = iterations(input.path("iterations"));
      Map<String, Iteration> byId = new LinkedHashMap<>(); all.forEach(item -> byId.put(item.id(), item));
      List<Iteration> planned = input.path("count").path("plannedIds").valueStream().map(n -> byId.get(n.asString())).toList();
      List<Iteration> output = input.path("count").path("outputIds").valueStream().map(n -> byId.get(n.asString())).toList();
      var reading = Intentions.mixReadingOf(categories(input.path("categories")), new Distribution(shares(input.path("distribution").path("shares"))),
          nullableText(input.path("intention").path("scopeCategoryId")), planned, output, input.path("count").path("plannedPages").asInt(),
          input.path("count").path("outputPages").asInt(), item -> nullableInt(input.path("pagesById").path(item.id())));
      ArrayNode rows = JSON.createArrayNode(); for (var row : reading.rows()) rows.add(JSON.valueToTree(java.util.Arrays.asList(row.categoryId(), row.flag())));
      ObjectNode result = JSON.createObjectNode(); result.set("rows", rows); result.set("unallocated", numberNode(reading.unallocated())); result.put("outOfBandCount", reading.outOfBandCount()); return result;
    });
    adapters.put("fillOf", input -> {
      List<Iteration> all = iterations(input.path("iterations")); Map<String, Iteration> byId = new LinkedHashMap<>(); all.forEach(item -> byId.put(item.id(), item));
      List<Iteration> planned = input.path("count").path("plannedIds").valueStream().map(n -> byId.get(n.asString())).toList();
      List<Iteration> delivered = input.path("count").path("deliveredIds").valueStream().map(n -> byId.get(n.asString())).toList();
      return JSON.valueToTree(Intentions.fillOf(categories(input.path("categories")), new Distribution(shares(input.path("distribution").path("shares"))),
          nullableText(input.path("intention").path("scopeCategoryId")), nullableInt(input.path("intention").path("targetPages")), planned, delivered,
          item -> nullableInt(input.path("pagesById").path(item.id()))).stream().map(row -> java.util.Arrays.asList(row.categoryId(), row.targetPages(), row.plannedPages(), row.isShort())).toList());
    });
    adapters.put("correctionOf", input -> {
      List<Intentions.CorrectionInputRow> rows = new ArrayList<>(); input.path("rows").forEach(row -> rows.add(new Intentions.CorrectionInputRow(text(row, "categoryId"), nullableDouble(row.path("intended")), row.path("outputPages").asInt())));
      var correction = Intentions.correctionOf(rows, input.path("outputPages").asInt(), input.path("pages").asInt(), integerMap(input.path("readyPagesByCategory")));
      ObjectNode result = JSON.createObjectNode(); result.put("isCut", correction.isCut());
      result.set("rows", JSON.valueToTree(correction.rows().stream().map(row -> java.util.Arrays.asList(row.categoryId(), row.newPages(), numberNode(row.after()), row.shortPages())).toList())); return result;
    });
    adapters.put("isInWindow", input -> JSON.valueToTree(Intentions.isInWindow(
        text(input.path("intention"), "countsFrom"), nullableText(input.path("intention").path("endsOn")),
        nullableText(input.path("calendarDate")))));
    adapters.put("intentionStateOf", input -> JSON.valueToTree(Intentions.intentionStateOf(
        text(input.path("intention"), "countsFrom"), nullableText(input.path("intention").path("endsOn")),
        text(input, "today")).name()));
    adapters.put("isInIntentionScope", input -> JSON.valueToTree(Intentions.isInIntentionScope(
        intention(input.path("intention")), iteration(input.path("iteration")), categories(input.path("categories")),
        (conditions, item) -> input.path("conditionsMatch").asBoolean())));
    adapters.put("effectiveShareOf", input -> numberNode(Mixes.effectiveShareOf(
        categories(input.path("categories")), shares(input.path("shares")), text(input, "categoryId"))));
    adapters.put("siblingSetOf", input -> {
      Mixes.SiblingSet set = Mixes.siblingSetOf(categories(input.path("categories")), shares(input.path("shares")),
          nullableText(input.path("parentId")));
      ObjectNode result = JSON.createObjectNode();
      result.set("unallocated", numberNode(set.unallocated()));
      result.set("noShareIds", JSON.valueToTree(set.noShareIds()));
      return result;
    });
    adapters.put("mixCategoriesOf", input -> JSON.valueToTree(Intentions.mixCategoriesOf(
        categories(input.path("categories")), nullableText(input.path("scopeCategoryId"))).stream()
        .map(Category::id).toList()));
    adapters.put("mixNodesOf", input -> JSON.valueToTree(Intentions.mixNodesOf(
        categories(input.path("categories")), nullableText(input.path("scopeCategoryId"))).stream()
        .map(Category::id).toList()));
    adapters.put("countIntention", input -> {
      Intentions.IntentionCount count = Intentions.countIntention(intention(input.path("intention")), countingData(input));
      ObjectNode out = JSON.createObjectNode();
      out.set("planned", JSON.valueToTree(count.planned()));
      out.set("delivered", JSON.valueToTree(count.delivered()));
      out.set("output", JSON.valueToTree(count.output()));
      out.put("plannedPages", count.plannedPages());
      out.put("deliveredPages", count.deliveredPages());
      out.put("outputPages", count.outputPages());
      out.put("noDateCount", count.noDateCount());
      out.put("noPagesCount", count.noPagesCount());
      return out;
    });
    adapters.put("countsTowardsOf", input -> JSON.valueToTree(Intentions.countsTowardsOf(
        intentions(input.path("intentions")), members(input), text(input, "startsOn"), countingData(input)).stream()
        .map(row -> List.of(row.intentionId(), row.itemCount(), row.pages())).toList()));
    adapters.put("shareWithinOf", input -> numberNode(Intentions.shareWithinOf(
        categories(input.path("categories")), new Distribution(shares(input.path("distribution").path("shares"))),
        nullableText(input.path("scopeCategoryId")), text(input, "categoryId"))));
    adapters.put("listMixOf", input -> JSON.valueToTree(Intentions.listMixOf(
        categories(input.path("categories")), new Distribution(shares(input.path("distribution").path("shares"))),
        nullableText(input.path("intention").path("scopeCategoryId")), members(input),
        nullableInt(input.path("goal").path("targetPages")), nullableIntMap(input.path("goal").path("allocation")),
        item -> nullableInt(input.path("pagesById").path(item.id()))).stream()
        .map(row -> java.util.Arrays.asList(row.categoryId(), numberNode(row.share()), row.pages(), row.goalPages())).toList()));
    adapters.put("targetVerdictOf", input -> {
      Intentions.TargetVerdict verdict = Intentions.targetVerdictOf(intention(input.path("intention")),
          input.path("plannedPages").asInt(), input.path("deliveredPages").asInt(), text(input, "today"));
      return JSON.valueToTree(verdict == null ? null : verdict.wireName());
    });
    return Map.copyOf(adapters);
  }

  private static DigitizationList digitizationList(JsonNode node) {
    return new DigitizationList(text(node, "id"), text(node, "name"), text(node, "startsOn"),
        text(node, "endsOn"), nullableInt(node.path("targetPages")), nullableText(node.path("done").path("at")));
  }

  private static Projects.ProjectMembers projectMembers(JsonNode node) {
    return new Projects.ProjectMembers(text(node, "managerId"), strings(node.path("memberIds")),
        strings(node.path("memberGroupIds")));
  }

  private static List<String> strings(JsonNode nodes) {
    List<String> result = new ArrayList<>();
    nodes.forEach(node -> result.add(node.asString()));
    return result;
  }

  private static PropertyCondition propertyCondition(JsonNode node) {
    Map<String, Double> numberRange = node.has("numberRange")
        ? JSON.convertValue(node.path("numberRange"), JSON.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Double.class))
        : null;
    Map<String, String> dayRange = node.has("dayRange")
        ? JSON.convertValue(node.path("dayRange"), JSON.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, String.class))
        : null;
    return new PropertyCondition(nullableText(node.path("key")), node.path("hasNoValue").asBoolean(false),
        nullableText(node.path("contains")), nullableText(node.path("startsWith")),
        nullableText(node.path("endsWith")), numberRange, dayRange,
        node.has("anyOf") ? strings(node.path("anyOf")) : null);
  }

  private static JsonNode propertyConditionJson(PropertyCondition condition) {
    ObjectNode result = JSON.createObjectNode();
    putNullable(result, "key", condition.key());
    if (Boolean.TRUE.equals(condition.hasNoValue())) result.put("hasNoValue", true);
    putNullable(result, "contains", condition.contains());
    putNullable(result, "startsWith", condition.startsWith());
    putNullable(result, "endsWith", condition.endsWith());
    if (condition.numberRange() != null) result.set("numberRange", JSON.valueToTree(condition.numberRange()));
    if (condition.dayRange() != null) result.set("dayRange", JSON.valueToTree(condition.dayRange()));
    if (condition.anyOf() != null) result.set("anyOf", JSON.valueToTree(condition.anyOf()));
    return result;
  }

  private static void putNullable(ObjectNode node, String key, String value) {
    if (value != null) node.put(key, value);
  }

  private static List<Properties.Source> propertySources(JsonNode nodes) {
    List<Properties.Source> result = new ArrayList<>();
    nodes.forEach(node -> {
      JsonNode source = node.path("source");
      result.add(new Properties.Source(text(source, "kind"), nullableText(source.path("instanceId")),
          nullableText(source.path("instanceName")), node.path("tier").asInt(),
          generic(node.path("value")), text(node, "observedAt"), nullableText(node.path("setBy"))));
    });
    return result;
  }

  private static JsonNode sourceJson(Properties.Source source) {
    return source == null ? JSON.nullNode() : sourcesJson(List.of(source)).get(0);
  }

  private static ArrayNode sourcesJson(List<Properties.Source> sources) {
    ArrayNode result = JSON.createArrayNode();
    for (Properties.Source source : sources) {
      ObjectNode item = result.addObject();
      ObjectNode origin = item.putObject("source");
      origin.put("kind", source.kind());
      putNullable(origin, "instanceId", source.instanceId());
      putNullable(origin, "instanceName", source.instanceName());
      item.put("tier", source.tier());
      item.set("value", JSON.valueToTree(source.value()));
      item.put("observedAt", source.observedAt());
      if (source.setBy() == null) item.putNull("setBy"); else item.put("setBy", source.setBy());
    }
    return result;
  }

  private static List<Properties.PropertyValues> propertyValues(JsonNode nodes) {
    List<Properties.PropertyValues> result = new ArrayList<>();
    nodes.forEach(node -> result.add(new Properties.PropertyValues(text(node, "key"), propertySources(node.path("sources")))));
    return result;
  }

  private static Properties.Definition propertyDefinition(JsonNode node) {
    JsonNode type = node.path("type");
    List<String> values = new ArrayList<>();
    Map<String, String> names = new LinkedHashMap<>();
    type.path("values").forEach(item -> {
      String value = text(item, "value");
      values.add(value);
      names.put(value, text(item.path("names"), "en"));
    });
    String kind = text(type, "kind");
    Properties.PropertyKind propertyKind = java.util.Arrays.stream(Properties.PropertyKind.values())
        .filter(candidate -> candidate.wireName().equals(kind)).findFirst().orElseThrow();
    return new Properties.Definition(text(node, "key"), propertyKind, type.path("unit").asString(""),
        node.path("isList").asBoolean(), values, names, node.path("isCatalogFact").asBoolean());
  }

  private static Object generic(JsonNode node) {
    return JSON.convertValue(node, Object.class);
  }

  private static JsonNode mergeBase(JsonNode base, JsonNode input) {
    ObjectNode result = base.isObject() ? (ObjectNode) base.deepCopy() : JSON.createObjectNode();
    for (var field : input.properties()) {
      result.set(field.getKey(), field.getValue());
    }
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
    node.path("defects").forEach(item -> defects.add(defect(item)));
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
        restriction.isNull() ? null : new Restriction(text(restriction, "rule"), text(restriction, "foundAt")),
        override.isNull() ? null : new RestrictionOverride(text(override, "note")),
        cancellation.isNull() || cancellation.isMissingNode() ? null
                              : new Cancellation(CancellationCause.valueOf(text(cancellation, "cause"))),
        defects, verdicts, List.of(), nullableText(node.path("listId")), nullableText(node.path("digitizedAt")));
  }

  private static Intention intention(JsonNode node) {
    JsonNode archived = node.path("archived");
    return new Intention(text(node, "id"), funding(node.path("funding")),
        nullableText(node.path("scopeCategoryId")), propertyConditions(node.path("scopeConditions")),
        text(node, "countsFrom"), nullableText(node.path("endsOn")),
        nullableInt(node.path("targetPages")), node.path("isOverall").asBoolean(),
        archived.isNull() || archived.isMissingNode() ? null : text(archived, "at"));
  }

  private static List<PropertyCondition> propertyConditions(JsonNode nodes) {
    List<PropertyCondition> conditions = new ArrayList<>();
    nodes.forEach(node -> {
      JsonNode numberRange = node.path("numberRange");
      Map<String, Double> numbers = numberRange.isObject() ? new LinkedHashMap<>() : null;
      if (numbers != null) {
        numberRange.properties().forEach(entry -> numbers.put(entry.getKey(), entry.getValue().asDouble()));
      }
      JsonNode dayRange = node.path("dayRange");
      Map<String, String> days = dayRange.isObject() ? new LinkedHashMap<>() : null;
      if (days != null) {
        dayRange.properties().forEach(entry -> days.put(entry.getKey(), entry.getValue().asString()));
      }
      List<String> anyOf = new ArrayList<>();
      node.path("anyOf").forEach(value -> anyOf.add(value.asString()));
      conditions.add(new PropertyCondition(text(node, "key"),
          node.path("hasNoValue").isMissingNode() ? null : node.path("hasNoValue").asBoolean(),
          nullableText(node.path("contains")), nullableText(node.path("startsWith")),
          nullableText(node.path("endsWith")), numbers, days, anyOf));
    });
    return conditions;
  }

  private static Intentions.CountingData countingData(JsonNode input) {
    java.util.function.BiPredicate<List<PropertyCondition>, Iteration> meetsConditions =
        input.has("conditionsMatch") ? (conditions, item) -> input.path("conditionsMatch").asBoolean() : null;
    return new Intentions.CountingData(categories(input.path("categories")), lists(input.path("lists")),
        iterations(input.path("iterations")), item -> nullableInt(input.path("pagesById").path(item.id())),
        meetsConditions);
  }

  private static IntentionFunding funding(JsonNode node) {
    return new IntentionFunding(text(node, "kind"), nullableText(node.path("projectId")));
  }

  private static List<Intention> intentions(JsonNode nodes) {
    List<Intention> values = new ArrayList<>();
    nodes.forEach(node -> values.add(intention(node)));
    return values;
  }

  private static List<Iteration> iterations(JsonNode nodes) {
    List<Iteration> values = new ArrayList<>();
    nodes.forEach(node -> values.add(iteration(node)));
    return values;
  }

  private static List<Iteration> members(JsonNode input) {
    Map<String, Iteration> byId = new LinkedHashMap<>();
    iterations(input.path("iterations")).forEach(item -> byId.put(item.id(), item));
    List<Iteration> values = new ArrayList<>();
    input.path("memberIds").forEach(node -> values.add(byId.get(node.asString())));
    return values;
  }

  private static List<DigitizationList> lists(JsonNode nodes) {
    List<DigitizationList> values = new ArrayList<>();
    nodes.forEach(node -> {
      JsonNode done = node.path("done");
      values.add(new DigitizationList(text(node, "id"), text(node, "name"), text(node, "startsOn"),
          text(node, "endsOn"), nullableInt(node.path("targetPages")),
          done.isNull() || done.isMissingNode() ? null : text(done, "at")));
    });
    return values;
  }

  private static Map<String, Double> shares(JsonNode node) {
    Map<String, Double> values = new LinkedHashMap<>();
    node.properties().forEach(entry -> values.put(entry.getKey(), entry.getValue().asDouble()));
    return values;
  }

  private static Map<String, Integer> nullableIntMap(JsonNode node) {
    if (node.isNull() || node.isMissingNode()) {
      return null;
    }
    Map<String, Integer> values = new LinkedHashMap<>();
    node.properties().forEach(entry -> values.put(entry.getKey(), entry.getValue().asInt()));
    return values;
  }

  private static Integer nullableInt(JsonNode node) {
    return node.isNull() || node.isMissingNode() ? null : node.asInt();
  }

  private static JsonNode numberNode(Double value) {
    if (value == null) {
      return JSON.nullNode();
    }
    if (value == Math.rint(value)) {
      return JSON.valueToTree(value.intValue());
    }
    return JSON.valueToTree(value);
  }

  private static JsonNode numberNode(double value) {
    return numberNode(Double.valueOf(value));
  }

  private static Defect defect(JsonNode node) {
    return new Defect(text(node, "key"), text(node, "instanceId"), text(node, "ruleCode"),
        text(node, "subject"), text(node, "firstSeenAt"));
  }

  private static List<Category> categories(JsonNode nodes) {
    List<Category> result = new ArrayList<>();
    nodes.forEach(node -> result.add(new Category(text(node, "id"), text(node, "name"), nullableText(node.path("parentId")))));
    return result;
  }

  private static Categories.CustodyHolders custodyHolders(JsonNode node) {
    List<Categories.CustodyGroup> groups = new ArrayList<>();
    node.path("groups").forEach(group -> groups.add(new Categories.CustodyGroup(text(group, "id"), text(group, "name"),
        strings(group.path("categoryIds")), strings(group.path("memberIds")))));
    Map<String, List<String>> members = new LinkedHashMap<>();
    node.path("members").properties().forEach(field -> members.put(field.getKey(), strings(field.getValue())));
    return new Categories.CustodyHolders(groups, members);
  }

  private static List<Intentions.ProjectScope> projectScopes(JsonNode nodes) {
    List<Intentions.ProjectScope> result = new ArrayList<>();
    nodes.forEach(node -> result.add(new Intentions.ProjectScope(text(node, "id"), text(node, "managerId"),
        strings(node.path("memberIds")), strings(node.path("memberGroupIds")))));
    return result;
  }

  private static Double nullableDouble(JsonNode node) {
    return node.isNull() || node.isMissingNode() ? null : node.asDouble();
  }

  private static Map<String, Integer> integerMap(JsonNode node) {
    Map<String, Integer> result = new LinkedHashMap<>();
    node.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue().asInt()));
    return result;
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

  private static Tasks.Session taskSession(JsonNode input) {
    return new Tasks.Session(text(input, "userId"), grants(input.path("grants")));
  }

  private static Tasks.Run taskRun(JsonNode input) {
    return new Tasks.Run(text(input, "state"), nullableText(input.path("startedBy")),
        input.path("rerunnable").asBoolean());
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
