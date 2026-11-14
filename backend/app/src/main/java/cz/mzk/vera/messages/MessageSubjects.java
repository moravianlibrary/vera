package cz.mzk.vera.messages;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.account.IdentityClaims;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.projects.ProjectReads;
import cz.mzk.vera.requests.RequestQueries;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// MSG-recipients: resolve visible records, their people, and each instance's reach.
@Component
final class MessageSubjects {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final RequestQueries requests;
    private final ProjectReads projects;
    private final DocumentQueries documents;
    private final JsonMapper json;
    private final IdentityClaims identityClaims;

    MessageSubjects(DSLContext dsl, HeldAccessQueries access, RequestQueries requests,
            ProjectReads projects, DocumentQueries documents, JsonMapper json,
            IdentityClaims identityClaims) {
        this.dsl = dsl;
        this.access = access;
        this.requests = requests;
        this.projects = projects;
        this.documents = documents;
        this.json = json;
        this.identityClaims = identityClaims;
    }

    Subject resolve(String userId, String kind, String id) {
        if ("proposal".equals(kind)) {
            Map<String, Object> detail = requests.detail(id, userId);
            if (detail == null) {
                return null;
            }
            Map<?, ?> row = (Map<?, ?>) detail.get("row");
            Map<?, ?> record = (Map<?, ?>) row.get("record");
            Map<?, ?> document = (Map<?, ?>) record.get("document");
            List<?> asks = (List<?>) record.get("requests");
            List<String> recipients = asks.stream()
                    .map(value -> (String) ((Map<?, ?>) value).get("requesterId")).distinct().toList();
            List<String> projectIds = asks.stream()
                    .map(value -> (String) ((Map<?, ?>) value).get("projectId"))
                    .filter(value -> value != null).distinct().toList();
            List<String> projectNames = projectIds.isEmpty() ? List.of()
                    : dsl.select(PROJECTS.NAME).from(PROJECTS).where(PROJECTS.ID.in(projectIds))
                            .orderBy(PROJECTS.POSITION).fetch(PROJECTS.NAME);
            String label = label(document);
            String context = "Proposed for digitization · " + asks.size() + " asks"
                    + projectNames.stream().map(name -> " · " + name).collect(Collectors.joining());
            return new Subject(label, "/requests?id=" + encode(id), context, recipients);
        }
        if ("project".equals(kind)) {
            Map<String, Object> detail = projects.detail(userId, id);
            if (detail == null) {
                return null;
            }
            Map<?, ?> row = (Map<?, ?>) detail.get("row");
            Map<?, ?> project = (Map<?, ?>) row.get("project");
            return new Subject((String) project.get("name"), "/projects?id=" + encode(id),
                    "Project · " + project.get("state"), List.of((String) project.get("managerId")));
        }
        if ("overrule".equals(kind) || "forbiddenAskers".equals(kind)) {
            return restriction(userId, kind, id);
        }
        if ("listedItem".equals(kind)) {
            return listedItem(userId, id);
        }
        return null;
    }

    List<Recipient> recipients(Subject subject, String sender) {
        return subject.recipientIds().stream().filter(id -> !id.equals(sender))
                .map(id -> dsl.selectFrom(USERS).where(USERS.ID.eq(id)).fetchOne())
                .filter(user -> user != null && "person".equals(user.getKind()))
                .map(user -> new Recipient(user.getId(), user.getName())).toList();
    }

    String emailOf(String userId) {
        return dsl.select(USERS.EMAIL).from(USERS).where(USERS.ID.eq(userId)).fetchOne(USERS.EMAIL);
    }

    List<String> reachable(String instanceId, String implementation, List<Recipient> recipients) {
        return recipients.stream().filter(recipient -> canReach(instanceId, implementation, recipient.userId()))
                .map(Recipient::userId).toList();
    }

    List<String> routedRecipients(String instanceId, String implementation, List<String> userIds) {
        if ("slackBot".equals(implementation)) {
            return userIds;
        }
        if ("mailto".equals(implementation)) {
            return userIds.stream().map(userId -> dsl.select(USERS.EMAIL).from(USERS)
                    .where(USERS.ID.eq(userId)).fetchOne(USERS.EMAIL)).toList();
        }
        String claimName = handleClaim(instanceId);
        return userIds.stream().map(userId -> identityClaims.value(userId, claimName)).toList();
    }

    private Subject restriction(String userId, String kind, String id) {
        HeldScopes held = access.scopesHeldBy(userId);
        if (!held.hasPermission("iteration.read")) {
            return null;
        }
        IterationsRecord iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
        if (iteration == null || iteration.getRestrictionRule() == null) {
            return null;
        }
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
        List<String> categoryPath = Categories.lineageOf(categories, iteration.getCategoryId());
        boolean canReview = List.of("validation.approve", "validation.deny", "validation.revoke")
                .stream().anyMatch(permission -> held.reachesIteration(permission, categoryPath));
        if (!canReview) {
            return null;
        }
        Map<String, Object> detail = documents.detail(iteration.getDocumentId(), userId, false);
        if (detail == null) {
            return null;
        }
        Map<?, ?> record = (Map<?, ?>) detail.get("record");
        Map<?, ?> document = (Map<?, ?>) record.get("document");
        List<String> recipientIds = "overrule".equals(kind) ? overruleHolders() : requestsForIteration(id);
        String explanation = iteration.getRestrictionInternalText() == null
                ? iteration.getRestrictionPublicText() : iteration.getRestrictionInternalText();
        return new Subject(label(document), "/review/documents?id=" + encode(id) + "&review=Forbidden",
                "Forbidden by " + iteration.getRestrictionRule() + ": " + explanation, recipientIds);
    }

    private List<String> overruleHolders() {
        return dsl.select(USERS.ID).from(USERS).orderBy(USERS.POSITION).fetch(USERS.ID).stream()
                .filter(personId -> access.scopesHeldBy(personId).hasPermission("restriction.overrule"))
                .toList();
    }

    private List<String> requestsForIteration(String id) {
        return dsl.selectDistinct(REQUESTS.REQUESTER_ID).from(REQUESTS)
                .where(REQUESTS.ITERATION_ID.eq(id).or(REQUESTS.TRACKS_ITERATION_ID.eq(id)))
                .orderBy(REQUESTS.REQUESTER_ID).fetch(REQUESTS.REQUESTER_ID);
    }

    private Subject listedItem(String userId, String id) {
        IterationsRecord iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
        if (iteration == null || iteration.getListId() == null) {
            return null;
        }
        Map<String, Object> detail = documents.detail(iteration.getDocumentId(), userId, false);
        DigitizationListsRecord list = dsl.selectFrom(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.eq(iteration.getListId())).fetchOne();
        if (detail == null || list == null) {
            return null;
        }
        Map<?, ?> record = (Map<?, ?>) detail.get("record");
        Map<?, ?> document = (Map<?, ?>) record.get("document");
        return new Subject(label(document), "/documents?id=" + encode(iteration.getDocumentId()),
                "On the list " + list.getName(), List.of(list.getCreatedBy()));
    }

    private boolean canReach(String instanceId, String implementation, String userId) {
        if ("mailto".equals(implementation)) {
            return dsl.fetchExists(dsl.selectOne().from(USERS)
                    .where(USERS.ID.eq(userId).and(USERS.EMAIL.isNotNull())));
        }
        String claimName = handleClaim(instanceId);
        return claimName != null && identityClaims.value(userId, claimName) != null;
    }

    private String handleClaim(String instanceId) {
        JSONB configuration = dsl.select(PLUGIN_INSTANCES.CONFIGURATION).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(instanceId).and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                        .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()))
                .fetchOne(PLUGIN_INSTANCES.CONFIGURATION);
        if (configuration == null) {
            return null;
        }
        String handle = json.readTree(configuration.data()).path("handle").asString();
        if (handle == null || !handle.startsWith("claim ")) {
            return null;
        }
        String claimName = handle.substring("claim ".length()).trim();
        return claimName.isEmpty() ? null : claimName;
    }

    private String label(Map<?, ?> document) {
        String catalog = (String) document.get("catalogId");
        Map<?, ?> unit = (Map<?, ?>) document.get("unit");
        String identifier = unit == null ? catalog : catalog + " · " + unit.get("value");
        return document.get("title") + " · " + identifier;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    record Subject(String label, String path, String context, List<String> recipientIds) {}

    record Recipient(String userId, String name) {
        Map<String, Object> asMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("userId", userId);
            result.put("name", name);
            return result;
        }
    }
}
