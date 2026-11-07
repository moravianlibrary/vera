package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.db.tables.tables.records.IterationLinksRecord;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import java.net.URI;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-reclassify; ACT-publish; ACT-link-replace; ACT-link-primary; ACT-link-remove; LOG-one-act-one-story.
@Component
public class IterationCommands {
    private static final Pattern KRAMERIUS_PID = Pattern.compile(
            "uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            Pattern.CASE_INSENSITIVE);
    private static final String PUBLISHED = "Published";
    private final DSLContext dsl;
    private final IterationAccess access;
    private final DocumentStates states;
    private final EventRecorder events;
    private final HeldAccessQueries heldAccess;
    private final Clock clock;
    private final JsonMapper json;

    public IterationCommands(DSLContext dsl, IterationAccess access, DocumentStates states,
            EventRecorder events, HeldAccessQueries heldAccess, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.states = states;
        this.events = events;
        this.heldAccess = heldAccess;
        this.clock = clock;
        this.json = json;
    }

    // reclassifyIteration: V13, LC-ITER-reclassify; change category and priority before the scan.
    @Transactional
    public ActResult reclassify(Caller caller, String iterationId, Reclassification body) {
        IterationAccess.Result found = access.actionableIteration(caller, iterationId, IterationCodes.CLASSIFY);
        if (found.refusal() != null) {
            return found.refusal();
        }
        var iteration = found.value().iteration();
        if ("Digitized".equals(iteration.getProgress()) || PUBLISHED.equals(iteration.getProgress())) {
            return ActResult.refused(409, "It is scanned; its category and priority stay",
                    IterationCodes.SCANNED);
        }
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
        boolean leaf = !Categories.lineageOf(categories, body.categoryId()).isEmpty()
                && Categories.leavesOf(categories).stream().anyMatch(item -> item.id().equals(body.categoryId()));
        if (!leaf) {
            return ActResult.refused(422, "Choose a category with no subcategories",
                    IterationCodes.CATEGORY_NOT_LEAF);
        }
        String oldCategory = iteration.getCategoryId();
        String oldPriority = iteration.getPriority();
        if (oldCategory.equals(body.categoryId()) && oldPriority.equals(body.priority())) {
            return ActResult.refused(422, "Nothing changed", IterationCodes.NOTHING_CHANGED);
        }
        dsl.update(ITERATIONS).set(ITERATIONS.CATEGORY_ID, body.categoryId())
                .set(ITERATIONS.PRIORITY, body.priority())
                .where(ITERATIONS.ID.eq(iterationId)).execute();
        boolean handedOver = !hasCategoryReach(caller.userId(), IterationCodes.CLASSIFY, categories,
                body.categoryId());
        Map<String, Object> categoryChange = oldCategory.equals(body.categoryId()) ? null
                : Map.of("from", Map.of("id", oldCategory, "name", categoryName(categories, oldCategory)),
                        "to", Map.of("id", body.categoryId(), "name", categoryName(categories, body.categoryId())));
        Map<String, Object> priorityChange = oldPriority.equals(body.priority()) ? null
                : Map.of("from", oldPriority, "to", body.priority());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("category", categoryChange);
        data.put("priority", priorityChange);
        Map<String, Object> reason = new LinkedHashMap<>();
        reason.put("public", null);
        reason.put("internal", handedOver
                ? "Handed over to the custody that holds the new category." : null);
        record(EventCode.ITERATION_RECLASSIFIED, iterationId, caller.userId(), data, reason);
        states.recompute(dsl, iteration.getDocumentId());
        return ActResult.ok(Map.of("categoryId", body.categoryId(), "priority", body.priority(),
                "isHandedOver", handedOver));
    }

    // publishIteration: P1, LC-ITER-published; the first canonical link publishes the iteration.
    @Transactional
    public ActResult publish(Caller caller, String iterationId, Publication body) {
        IterationAccess.Result found = access.actionableIteration(caller, iterationId, IterationCodes.PUBLISH);
        if (found.refusal() != null) {
            return found.refusal();
        }
        var iteration = found.value().iteration();
        if (!"Digitized".equals(iteration.getProgress()) && !PUBLISHED.equals(iteration.getProgress())) {
            return ActResult.refused(409, "It is not digitized yet.", IterationCodes.NOT_DIGITIZED);
        }
        Link canonical = canonicalLinkOf(body.link());
        if (canonical == null) {
            return unread();
        }
        if (linkExists(iterationId, canonical.url(), null)) {
            return exists();
        }
        int position = nextPosition(iterationId);
        String linkId = UUID.randomUUID().toString();
        OffsetDateTime at = now();
        boolean first = position == 0;
        insertLink(iterationId, position, linkId, canonical, caller.userId(), at, first);
        if (first) {
            dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, PUBLISHED)
                    .where(ITERATIONS.ID.eq(iterationId)).execute();
        }
        record(first ? EventCode.ITERATION_PUBLISHED : EventCode.ITERATION_LINK_ADDED,
                iterationId, caller.userId(), Map.of("link", Map.of("id", linkId, "url", canonical.url())),
                emptyReason());
        states.recompute(dsl, iteration.getDocumentId());
        return ActResult.ok(publicationResult(iterationId));
    }

    // replaceIterationLink: LC-ITER-links; keep the link identity, position and primary selection.
    @Transactional
    public ActResult replaceLink(Caller caller, String iterationId, String linkId, Publication body) {
        IterationAccess.Result found = access.actionableIteration(caller, iterationId, IterationCodes.PUBLISH);
        if (found.refusal() != null) {
            return found.refusal();
        }
        var iteration = found.value().iteration();
        var old = dsl.selectFrom(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                .and(ITERATION_LINKS.ID.eq(linkId))).fetchOne();
        if (old == null) {
            return ActResult.refused(404, "No such link", null);
        }
        Link canonical = canonicalLinkOf(body.link());
        if (canonical == null) {
            return unread();
        }
        if (linkExists(iterationId, canonical.url(), linkId)) {
            return exists();
        }
        dsl.update(ITERATION_LINKS).set(ITERATION_LINKS.URL, canonical.url())
                .set(ITERATION_LINKS.INSTANCE_ID, canonical.instanceId())
                .set(ITERATION_LINKS.SET_BY, caller.userId()).set(ITERATION_LINKS.SET_AT, now())
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId).and(ITERATION_LINKS.ID.eq(linkId)))
                .execute();
        Map<String, Object> data = Map.of("link", Map.of("id", linkId, "url", canonical.url()),
                "url", Map.of("from", old.getUrl(), "to", canonical.url()));
        record(EventCode.ITERATION_LINK_CHANGED, iterationId, caller.userId(), data, emptyReason());
        states.recompute(dsl, iteration.getDocumentId());
        return ActResult.ok(publicationResult(iterationId));
    }

    // makeIterationLinkPrimary: LC-ITER-links; the selected link is the sole primary link.
    @Transactional
    public ActResult makePrimary(Caller caller, String iterationId, String linkId) {
        IterationAccess.Result found = access.actionableIteration(caller, iterationId, IterationCodes.PUBLISH);
        if (found.refusal() != null) {
            return found.refusal();
        }
        var iteration = found.value().iteration();
        var link = dsl.selectFrom(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                .and(ITERATION_LINKS.ID.eq(linkId))).fetchOne();
        if (link == null) {
            return ActResult.refused(404, "No such link", null);
        }
        if (link.getIsPrimary()) {
            return ActResult.refused(409, "It is already the primary link", IterationCodes.ALREADY_PRIMARY_LINK);
        }
        dsl.update(ITERATION_LINKS).set(ITERATION_LINKS.IS_PRIMARY, false)
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)).execute();
        dsl.update(ITERATION_LINKS).set(ITERATION_LINKS.IS_PRIMARY, true)
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId).and(ITERATION_LINKS.ID.eq(linkId)))
                .execute();
        record(EventCode.ITERATION_LINK_MADE_PRIMARY, iterationId, caller.userId(),
                Map.of("link", Map.of("id", linkId, "url", link.getUrl())), emptyReason());
        states.recompute(dsl, iteration.getDocumentId());
        return ActResult.ok(publicationResult(iterationId));
    }

    // removeIterationLink: LC-ITER-links; removing the primary promotes the oldest remaining link.
    @Transactional
    public ActResult removeLink(Caller caller, String iterationId, String linkId) {
        IterationAccess.Result found = access.actionableIteration(caller, iterationId, IterationCodes.PUBLISH);
        if (found.refusal() != null) {
            return found.refusal();
        }
        var iteration = found.value().iteration();
        var link = dsl.selectFrom(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                .and(ITERATION_LINKS.ID.eq(linkId))).fetchOne();
        if (link == null) {
            return ActResult.refused(404, "No such link", null);
        }
        List<IterationLinksRecord> links = dsl.selectFrom(ITERATION_LINKS)
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)).orderBy(ITERATION_LINKS.POSITION).fetch();
        if (links.size() == 1) {
            return ActResult.refused(409, "The last link cannot be removed", IterationCodes.LAST_LINK);
        }
        dsl.deleteFrom(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                .and(ITERATION_LINKS.ID.eq(linkId))).execute();
        var primary = links.stream().filter(item -> !item.getId().equals(linkId))
                .filter(item -> link.getIsPrimary() ? true : item.getIsPrimary())
                .min(Comparator.comparing(IterationLinksRecord::getSetAt))
                .orElseThrow();
        if (link.getIsPrimary()) {
            dsl.update(ITERATION_LINKS).set(ITERATION_LINKS.IS_PRIMARY, false)
                    .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)).execute();
            dsl.update(ITERATION_LINKS).set(ITERATION_LINKS.IS_PRIMARY, true)
                    .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                            .and(ITERATION_LINKS.ID.eq(primary.getId()))).execute();
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("link", Map.of("id", linkId, "url", link.getUrl()));
        data.put("primary", primary.getIsPrimary() || link.getIsPrimary()
                ? Map.of("id", primary.getId(), "url", primary.getUrl()) : null);
        record(EventCode.ITERATION_LINK_REMOVED, iterationId, caller.userId(), data, emptyReason());
        states.recompute(dsl, iteration.getDocumentId());
        return ActResult.ok(publicationResult(iterationId));
    }

    private boolean hasCategoryReach(String userId, String permission, List<Category> categories,
            String categoryId) {
        var scope = Iterations.scopeOfIteration(categories, categoryId);
        var held = accessScopes(userId);
        return held.scopesOf(permission).contains("any")
                || (held.scopesOf(permission).contains("custody")
                && scope.categoryPathIds().stream().anyMatch(held.custodyCategoryIds()::contains));
    }

    private cz.mzk.vera.session.HeldAccessQueries.HeldScopes accessScopes(String userId) {
        return heldAccess.scopesHeldBy(userId);
    }

    private String categoryName(List<Category> categories, String categoryId) {
        Map<String, String> names = new LinkedHashMap<>();
        dsl.select(CATEGORIES.ID, CATEGORIES.NAME).from(CATEGORIES).fetch()
                .forEach(row -> names.put(row.get(CATEGORIES.ID), row.get(CATEGORIES.NAME)));
        return Categories.lineageOf(categories, categoryId).stream().map(names::get)
                .collect(Collectors.joining(" / "));
    }

    private Link canonicalLinkOf(String typed) {
        String text = typed.trim();
        var instances = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.CONFIGURATION)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("Link")
                        .and(PLUGIN_IMPLEMENTATIONS.NAME.eq("KrameriusLink"))
                        .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                        .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()))
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch();
        Matcher matcher = KRAMERIUS_PID.matcher(text);
        String pid = matcher.find() ? matcher.group() : null;
        for (var instance : instances) {
            JsonNode configuration = json.readTree(instance.get(PLUGIN_INSTANCES.CONFIGURATION).data());
            String base = configuration.path("base_url").asString("").replaceAll("/+$", "");
            if (pid != null && !base.isEmpty()
                    && (text.equals(pid) || text.startsWith(base + "/"))) {
                return new Link(base + "/uuid/" + pid.toLowerCase(Locale.ROOT),
                        instance.get(PLUGIN_INSTANCES.ID));
            }
        }
        try {
            String scheme = URI.create(text).getScheme();
            return "http".equals(scheme) || "https".equals(scheme) ? new Link(text, null) : null;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void insertLink(String iterationId, int position, String linkId, Link link, String userId,
            OffsetDateTime at, boolean primary) {
        dsl.insertInto(ITERATION_LINKS).set(ITERATION_LINKS.ITERATION_ID, iterationId)
                .set(ITERATION_LINKS.POSITION, position).set(ITERATION_LINKS.ID, linkId)
                .set(ITERATION_LINKS.URL, link.url()).set(ITERATION_LINKS.INSTANCE_ID, link.instanceId())
                .set(ITERATION_LINKS.SET_BY, userId).set(ITERATION_LINKS.SET_AT, at)
                .set(ITERATION_LINKS.IS_PRIMARY, primary).execute();
    }

    private int nextPosition(String iterationId) {
        Integer maxPosition = dsl.select(max(ITERATION_LINKS.POSITION)).from(ITERATION_LINKS)
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)).fetchOne(0, Integer.class);
        return maxPosition == null ? 0 : maxPosition + 1;
    }

    private boolean linkExists(String iterationId, String url, String exceptId) {
        var query = dsl.selectOne().from(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)
                .and(ITERATION_LINKS.URL.eq(url)));
        if (exceptId != null) {
            query = query.and(ITERATION_LINKS.ID.ne(exceptId));
        }
        return dsl.fetchExists(query);
    }

    private Map<String, Object> publicationResult(String iterationId) {
        List<Map<String, Object>> links = dsl.selectFrom(ITERATION_LINKS)
                .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId)).orderBy(ITERATION_LINKS.POSITION)
                .fetch(row -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", row.getId());
                    value.put("url", row.getUrl());
                    value.put("instanceId", row.getInstanceId());
                    value.put("setBy", row.getSetBy());
                    value.put("setAt", Instants.format(row.getSetAt().toInstant()));
                    value.put("isPrimary", row.getIsPrimary());
                    return value;
                });
        String progress = dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(ITERATIONS.PROGRESS);
        return Map.of("links", links, "progress", progress);
    }

    private ActResult unread() {
        return ActResult.refused(422, "It is no web address, and no Link plugin reads it",
                IterationCodes.LINK_UNREAD);
    }

    private ActResult exists() {
        return ActResult.refused(422, "That link is already there.", IterationCodes.LINK_EXISTS);
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    private Map<String, Object> emptyReason() {
        Map<String, Object> reason = new LinkedHashMap<>();
        reason.put("public", null);
        reason.put("internal", null);
        return reason;
    }

    private void record(EventCode code, String iterationId, String userId, Map<String, Object> data,
            Map<String, Object> reason) {
        OffsetDateTime at = now();
        events.record(new EventInput(code, "iteration", iterationId, null,
                new EventInput.User(userId), Correlation.newId(), at.toInstant(), json.valueToTree(data),
                new EventInput.Reason((String) reason.get("public"), (String) reason.get("internal"))));
    }

    public record Reclassification(String categoryId, String priority) {}
    public record Publication(String link) {}
    private record Link(String url, String instanceId) {}
}
