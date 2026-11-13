package cz.mzk.vera.testing.seeds;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ARCHIVED_INTENTION_SNAPSHOTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.requests.RequestPlacements;
import cz.mzk.vera.requests.RequestSuggestions;
import java.time.LocalDate;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.TableField;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
// B8. Seeds the asking and deciding records before deriving their stored state.
class RecordsSeedLoader {
    private final DocumentStates states;
    private final RequestPlacements placements;
    private final RequestSuggestions suggestions;
    private final JsonMapper json;

    RecordsSeedLoader(DocumentStates states, RequestPlacements placements, RequestSuggestions suggestions,
            JsonMapper json) {
        this.states = states;
        this.placements = placements;
        this.suggestions = suggestions;
        this.json = json;
    }

    void load(DSLContext dsl, JsonNode collections) {
        projects(dsl, collections.path("projects"));
        properties(dsl, collections.path("propertyDefinitions"));
        mixes(dsl, collections.path("distributions"));
        intentionTemplates(dsl, collections.path("intentionTemplates"));
        intentions(dsl, collections.path("intentions"));
        archivedIntentionSnapshots(dsl, collections);
        lists(dsl, collections.path("lists"));
        custodies(dsl, collections.path("requestCustodies"));
        batches(dsl, collections.path("batches"));
        documents(dsl, collections.path("documents"));
        iterations(dsl, collections.path("iterations"));
        requests(dsl, collections.path("requests"));
        for (JsonNode request : collections.path("requests")) {
            placements.place(dsl, string(request, "id"));
            suggestions.suggest(dsl, string(request, "id"));
        }
        events(dsl, collections.path("statusLog"));
        for (JsonNode document : collections.path("documents")) {
            states.recompute(dsl, string(document, "id"));
        }
    }

    private void mixes(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            String id = string(row, "id");
            dsl.insertInto(MIXES)
                    .set(MIXES.ID, id)
                    .set(MIXES.NAME, string(row, "name"))
                    .set(MIXES.NAMES, JSONB.valueOf(namesJson(row)))
                    .set(MIXES.IS_PRIMARY, row.path("isPrimary").asBoolean())
                    .set(MIXES.ARCHIVED_AT, nullableInstant(row, "archivedAt"))
                    .set(MIXES.SHARES, JSONB.valueOf(row.path("shares").toString()))
                    .set(MIXES.REVISION, row.path("revision").asInt())
                    .set(MIXES.POSITION, position++)
                    .execute();
            int revisionPosition = 0;
            for (JsonNode revision : row.path("revisions")) {
                dsl.insertInto(MIX_REVISIONS)
                        .set(MIX_REVISIONS.MIX_ID, id)
                        .set(MIX_REVISIONS.REVISION, revision.path("revision").asInt())
                        .set(MIX_REVISIONS.SHARES, JSONB.valueOf(revision.path("shares").toString()))
                        .set(MIX_REVISIONS.AT, instant(revision, "at"))
                        .set(MIX_REVISIONS.LABEL, nullableString(revision, "label"))
                        .set(MIX_REVISIONS.POSITION, revisionPosition++)
                        .execute();
            }
        }
    }

    private void intentions(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            JsonNode funding = row.path("funding");
            JsonNode archived = row.path("archived");
            dsl.insertInto(INTENTIONS)
                    .set(INTENTIONS.ID, string(row, "id"))
                    .set(INTENTIONS.NAME, string(row, "name"))
                    .set(INTENTIONS.DESCRIPTION, string(row, "description"))
                    .set(INTENTIONS.FUNDING_KIND, string(funding, "kind"))
                    .set(INTENTIONS.FUNDING_PROJECT_ID, nullableString(funding, "projectId"))
                    .set(INTENTIONS.PROJECT_ID, nullableString(row, "projectId"))
                    .set(INTENTIONS.SCOPE_CATEGORY_ID, nullableString(row, "scopeCategoryId"))
                    .set(INTENTIONS.SCOPE_CONDITIONS, nullableJson(row, "scopeConditions"))
                    .set(INTENTIONS.DISTRIBUTION_ID, nullableString(row, "distributionId"))
                    .set(INTENTIONS.MIX_REVISION, nullableInteger(row, "mixRevision"))
                    .set(INTENTIONS.TARGET_PAGES, nullableInteger(row, "targetPages"))
                    .set(INTENTIONS.COUNTS_FROM, LocalDate.parse(string(row, "countsFrom")))
                    .set(INTENTIONS.ENDS_ON, nullableDate(row, "endsOn"))
                    .set(INTENTIONS.IS_OVERALL, row.path("isOverall").asBoolean())
                    .set(INTENTIONS.TEMPLATE_ID, nullableString(row, "templateId"))
                    .set(INTENTIONS.ARCHIVED_ACTOR_KIND, archived.isNull()
                            ? null : string(archived.path("actor"), "kind"))
                    .set(INTENTIONS.ARCHIVED_ACTOR_USER_ID, archived.isNull()
                            ? null : nullableString(archived.path("actor"), "userId"))
                    .set(INTENTIONS.ARCHIVED_AT, archived.isNull() ? null : instant(archived, "at"))
                    .set(INTENTIONS.POSITION, position++)
                    .execute();
        }
    }

    private void intentionTemplates(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            JsonNode funding = row.path("funding");
            dsl.insertInto(INTENTION_TEMPLATES)
                    .set(INTENTION_TEMPLATES.ID, string(row, "id"))
                    .set(INTENTION_TEMPLATES.DESCRIPTION, string(row, "description"))
                    .set(INTENTION_TEMPLATES.NAME_PATTERN, string(row, "namePattern"))
                    .set(INTENTION_TEMPLATES.EVERY, string(row, "every"))
                    .set(INTENTION_TEMPLATES.FUNDING_KIND, string(funding, "kind"))
                    .set(INTENTION_TEMPLATES.FUNDING_PROJECT_ID, nullableString(funding, "projectId"))
                    .set(INTENTION_TEMPLATES.SCOPE_CATEGORY_ID, nullableString(row, "scopeCategoryId"))
                    .set(INTENTION_TEMPLATES.SCOPE_CONDITIONS, nullableJson(row, "scopeConditions"))
                    .set(INTENTION_TEMPLATES.DISTRIBUTION_ID, nullableString(row, "distributionId"))
                    .set(INTENTION_TEMPLATES.MIX_REVISION, nullableInteger(row, "mixRevision"))
                    .set(INTENTION_TEMPLATES.TARGET_PAGES, nullableInteger(row, "targetPages"))
                    .set(INTENTION_TEMPLATES.IS_ARCHIVING_PREVIOUS, row.path("isArchivingPrevious").asBoolean())
                    .set(INTENTION_TEMPLATES.SINCE, LocalDate.parse(string(row, "since")))
                    .set(INTENTION_TEMPLATES.NEXT_ON, LocalDate.parse(string(row, "nextOn")))
                    .set(INTENTION_TEMPLATES.CREATED_BY, string(row, "createdBy"))
                    .set(INTENTION_TEMPLATES.POSITION, position++)
                    .execute();
        }
    }

    private void archivedIntentionSnapshots(DSLContext dsl, JsonNode collections) {
        JsonNode rows = collections.path("archivedIntentionRows");
        for (var entry : rows.properties()) {
            String id = entry.getKey();
            JsonNode mix = collections.path("archivedIntentionMixes").get(id);
            JsonNode categories = collections.path("archivedIntentionCategories").get(id);
            dsl.insertInto(ARCHIVED_INTENTION_SNAPSHOTS)
                    .set(ARCHIVED_INTENTION_SNAPSHOTS.INTENTION_ID, id)
                    .set(ARCHIVED_INTENTION_SNAPSHOTS.CAPTURED_ROW, JSONB.valueOf(entry.getValue().toString()))
                    .set(ARCHIVED_INTENTION_SNAPSHOTS.MIX_TREE,
                            mix == null || mix.isNull() ? null : JSONB.valueOf(mix.toString()))
                    .set(ARCHIVED_INTENTION_SNAPSHOTS.CATEGORY_TREE,
                            JSONB.valueOf(categories == null ? "[]" : categories.toString()))
                    .execute();
        }
    }

    private void lists(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            JsonNode done = row.path("done");
            dsl.insertInto(DIGITIZATION_LISTS)
                    .set(DIGITIZATION_LISTS.ID, string(row, "id"))
                    .set(DIGITIZATION_LISTS.NAME, string(row, "name"))
                    .set(DIGITIZATION_LISTS.STARTS_ON, LocalDate.parse(string(row, "startsOn")))
                    .set(DIGITIZATION_LISTS.ENDS_ON, LocalDate.parse(string(row, "endsOn")))
                    .set(DIGITIZATION_LISTS.TARGET_PAGES, nullableInteger(row, "targetPages"))
                    .set(DIGITIZATION_LISTS.GENERATED, nullableJson(row, "generated"))
                    .set(DIGITIZATION_LISTS.CREATED_BY, string(row, "createdBy"))
                    .set(DIGITIZATION_LISTS.CREATED_AT, instant(row, "createdAt"))
                    .set(DIGITIZATION_LISTS.DONE_ACTOR_ID, nullableString(done, "actorId"))
                    .set(DIGITIZATION_LISTS.DONE_AT, nullableInstant(done, "at"))
                    .set(DIGITIZATION_LISTS.POSITION, position++)
                    .execute();
        }
    }

    void catalogMirror(DSLContext dsl, JsonNode seed) {
        JsonNode records = seed.path("fakes").path("catalogRecords");
        JsonNode bases = seed.path("fakes").path("catalogBases");
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            JsonNode implementation = null;
            for (JsonNode candidate : seed.path("collections").path("pluginImplementations")) {
                if (candidate.path("id").asString().equals(instance.path("implementationId").asString())) {
                    implementation = candidate;
                    break;
                }
            }
            if (implementation == null || !implementation.path("kind").asString().equals("CatalogAdapter")) {
                continue;
            }
            String baseUrl = instance.path("configuration").path("base_url").asString();
            JsonNode catalog = bases.path(baseUrl);
            if (catalog.isMissingNode()) {
                continue;
            }
            int position = 0;
            for (JsonNode record : records) {
                String catalogId = record.path("catalogId").asString();
                if (!catalogId.startsWith(catalog.path("base").asString())) {
                    continue;
                }
                int recordPosition = position++;
                dsl.insertInto(CATALOG_MIRROR)
                        .set(CATALOG_MIRROR.INSTANCE_ID, instance.path("id").asString())
                        .set(CATALOG_MIRROR.CATALOG_ID, catalogId)
                        .set(CATALOG_MIRROR.TITLE, record.path("title").asString())
                        .set(CATALOG_MIRROR.TYPE, record.path("type").asString())
                        .set(CATALOG_MIRROR.UNITS, record.path("units").isNull() ? null
                                : JSONB.valueOf(record.path("units").toString()))
                        .set(CATALOG_MIRROR.RECORD, JSONB.valueOf(record.toString()))
                        .set(CATALOG_MIRROR.FETCHED_AT,
                                Instant.parse(seed.path("now").asString()).atOffset(ZoneOffset.UTC))
                        .set(CATALOG_MIRROR.POSITION, recordPosition)
                        .execute();
                addMirrorKeys(dsl, instance.path("id").asString(), catalogId, "identifier",
                        record.path("identifiers"));
                addMirrorKeys(dsl, instance.path("id").asString(), catalogId, "barcode",
                        record.path("barcodes"));
                addMirrorKeys(dsl, instance.path("id").asString(), catalogId, "shelfMark",
                        record.path("shelfMarks"));
            }
        }
    }

    private void addMirrorKeys(DSLContext dsl, String instanceId, String catalogId, String kind,
            JsonNode values) {
        int position = 0;
        if (values.isArray()) {
            for (JsonNode value : values) {
                String text = value.asString();
                dsl.insertInto(CATALOG_MIRROR_KEYS)
                        .set(CATALOG_MIRROR_KEYS.INSTANCE_ID, instanceId)
                        .set(CATALOG_MIRROR_KEYS.CATALOG_ID, catalogId)
                        .set(CATALOG_MIRROR_KEYS.KIND, kind)
                        .set(CATALOG_MIRROR_KEYS.VALUE, text)
                        .set(CATALOG_MIRROR_KEYS.NORMALIZED, normalizeKey(kind, text))
                        .set(CATALOG_MIRROR_KEYS.UNIT, (String) null)
                        .set(CATALOG_MIRROR_KEYS.POSITION, position++)
                        .execute();
            }
            return;
        }
        for (var entry : values.properties()) {
            String value = entry.getKey();
            JsonNode unitNode = entry.getValue();
            dsl.insertInto(CATALOG_MIRROR_KEYS)
                    .set(CATALOG_MIRROR_KEYS.INSTANCE_ID, instanceId)
                    .set(CATALOG_MIRROR_KEYS.CATALOG_ID, catalogId)
                    .set(CATALOG_MIRROR_KEYS.KIND, kind)
                    .set(CATALOG_MIRROR_KEYS.VALUE, value)
                    .set(CATALOG_MIRROR_KEYS.NORMALIZED, normalizeKey(kind, value))
                    .set(CATALOG_MIRROR_KEYS.UNIT, unitNode.isNull() ? null : unitNode.asString())
                    .set(CATALOG_MIRROR_KEYS.POSITION, position++)
                    .execute();
        }
    }

    private String normalizeKey(String kind, String value) {
        if (kind.equals("identifier")) {
            return value.replace("-", "").toLowerCase(Locale.ROOT);
        }
        if (kind.equals("shelfMark")) {
            return value.trim().toUpperCase(Locale.ROOT);
        }
        return value;
    }

    private void projects(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            String id = string(row, "id");
            dsl.insertInto(PROJECTS)
                    .set(PROJECTS.ID, id)
                    .set(PROJECTS.NAME, string(row, "name"))
                    .set(PROJECTS.STATE, string(row, "state"))
                    .set(PROJECTS.STARTS_ON, LocalDate.parse(string(row, "startsOn")))
                    .set(PROJECTS.ENDS_ON, LocalDate.parse(string(row, "endsOn")))
                    .set(PROJECTS.MANAGER_ID, string(row, "managerId"))
                    .set(PROJECTS.DESCRIPTION, string(row, "description"))
                    .set(PROJECTS.PRIORITY, nullableString(row, "priority"))
                    .set(PROJECTS.CREATED_AT, instant(row, "createdAt"))
                    .set(PROJECTS.ACTED_BY, nullableString(row, "actorId"))
                    .set(PROJECTS.ACTED_AT, nullableInstant(row, "at"))
                    .set(PROJECTS.REASON, nullableString(row, "reason"))
                    .set(PROJECTS.POSITION, position++)
                    .execute();
            insertIds(dsl, PROJECT_MEMBERS, PROJECT_MEMBERS.PROJECT_ID, id, row.path("memberIds"));
            insertIds(dsl, PROJECT_MEMBER_GROUPS, PROJECT_MEMBER_GROUPS.PROJECT_ID, id,
                    row.path("memberGroupIds"));
        }
    }

    private void properties(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            dsl.insertInto(PROPERTY_DEFINITIONS)
                    .set(PROPERTY_DEFINITIONS.KEY, string(row, "key"))
                    .set(PROPERTY_DEFINITIONS.NAMES, JSONB.valueOf(row.path("names").toString()))
                    .set(PROPERTY_DEFINITIONS.VISIBILITY, string(row, "visibility"))
                    .set(PROPERTY_DEFINITIONS.TYPE, JSONB.valueOf(row.path("type").toString()))
                    .set(PROPERTY_DEFINITIONS.IS_LIST, row.path("isList").asBoolean())
                    .set(PROPERTY_DEFINITIONS.ABOUT, string(row, "about"))
                    .set(PROPERTY_DEFINITIONS.HAND_TIER, nullableInteger(row, "handTier"))
                    .set(PROPERTY_DEFINITIONS.IS_PREDEFINED, row.path("isPredefined").asBoolean())
                    .set(PROPERTY_DEFINITIONS.POSITION, position++)
                    .execute();
        }
    }

    private void custodies(DSLContext dsl, JsonNode rows) {
        int position = 0;
        for (JsonNode row : rows) {
            String id = string(row, "id");
            dsl.insertInto(REQUEST_CUSTODIES)
                    .set(REQUEST_CUSTODIES.ID, id)
                    .set(REQUEST_CUSTODIES.NAME, string(row, "name"))
                    .set(REQUEST_CUSTODIES.NAMES, JSONB.valueOf(namesJson(row)))
                    .set(REQUEST_CUSTODIES.DESCRIPTION, string(row, "description"))
                    .set(REQUEST_CUSTODIES.IS_FALLBACK, row.path("isFallback").asBoolean())
                    .set(REQUEST_CUSTODIES.POSITION, position++)
                    .execute();
            insertIds(dsl, REQUEST_CUSTODY_MEMBERS, REQUEST_CUSTODY_MEMBERS.CUSTODY_ID, id,
                    row.path("memberIds"));
            insertIds(dsl, REQUEST_CUSTODY_GROUPS, REQUEST_CUSTODY_GROUPS.CUSTODY_ID, id,
                    row.path("groupIds"));
        }
    }

    private void batches(DSLContext dsl, JsonNode rows) {
        for (JsonNode row : rows) {
            JsonNode source = row.path("source");
            dsl.insertInto(BATCHES)
                    .set(BATCHES.ID, string(row, "id"))
                    .set(BATCHES.NAME, string(row, "name"))
                    .set(BATCHES.SUBMITTED_BY, string(row, "submittedBy"))
                    .set(BATCHES.SUBMITTED_AT, instant(row, "submittedAt"))
                    .set(BATCHES.SOURCE_INSTANCE_ID, source.isMissingNode() || source.isNull()
                            ? null : string(source, "instanceId"))
                    .set(BATCHES.SOURCE_NAME, source.isMissingNode() || source.isNull()
                            ? null : string(source, "name"))
                    .execute();
        }
    }

    private void documents(DSLContext dsl, JsonNode rows) {
        for (JsonNode row : rows) {
            JsonNode unit = row.path("unit");
            String id = string(row, "id");
            dsl.insertInto(DOCUMENTS)
                    .set(DOCUMENTS.ID, id)
                    .set(DOCUMENTS.CATALOG_ID, string(row, "catalogId"))
                    .set(DOCUMENTS.CATALOG_STATE, nullableJson(row, "catalogState"))
                    .set(DOCUMENTS.UNIT_TYPE, unit.isMissingNode() || unit.isNull()
                            ? null : string(unit, "type"))
                    .set(DOCUMENTS.UNIT_VALUE, unit.isMissingNode() || unit.isNull()
                            ? null : string(unit, "value"))
                    .set(DOCUMENTS.TITLE, string(row, "title"))
                    .set(DOCUMENTS.TYPE, string(row, "type"))
                    .set(DOCUMENTS.SHELF_MARK, nullableString(row, "shelfMark"))
                    .execute();
            int position = 0;
            for (JsonNode source : row.path("pageSources")) {
                dsl.insertInto(DOCUMENT_PAGE_SOURCES)
                        .set(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID, id)
                        .set(DOCUMENT_PAGE_SOURCES.POSITION, position++)
                        .set(DOCUMENT_PAGE_SOURCES.SOURCE, string(source, "source"))
                        .set(DOCUMENT_PAGE_SOURCES.TIER, source.path("tier").asInt())
                        .set(DOCUMENT_PAGE_SOURCES.VALUE, source.path("value").asInt())
                        .set(DOCUMENT_PAGE_SOURCES.OBSERVED_AT, instant(source, "observedAt"))
                        .set(DOCUMENT_PAGE_SOURCES.SET_BY, nullableString(source, "setBy"))
                        .execute();
            }
            position = 0;
            for (JsonNode source : row.path("registryRecords")) {
                dsl.insertInto(DOCUMENT_REGISTRY_RECORDS)
                        .set(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID, id)
                        .set(DOCUMENT_REGISTRY_RECORDS.POSITION, position++)
                        .set(DOCUMENT_REGISTRY_RECORDS.REGISTRY, string(source, "registry"))
                        .set(DOCUMENT_REGISTRY_RECORDS.STATE, string(source, "state"))
                        .set(DOCUMENT_REGISTRY_RECORDS.RAW_STATE, nullableString(source, "rawState"))
                        .set(DOCUMENT_REGISTRY_RECORDS.LINK_KIND, nullableString(source, "linkKind"))
                        .set(DOCUMENT_REGISTRY_RECORDS.URL, nullableString(source, "url"))
                        .set(DOCUMENT_REGISTRY_RECORDS.OBSERVED_AT, instant(source, "observedAt"))
                        .set(DOCUMENT_REGISTRY_RECORDS.CHECKED_AT, instant(source, "checkedAt"))
                        .set(DOCUMENT_REGISTRY_RECORDS.ERROR, nullableString(source, "error"))
                        .execute();
            }
            propertySources(dsl, DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID, id, row.path("properties"));
        }
    }

    private void iterations(DSLContext dsl, JsonNode rows) {
        for (JsonNode row : rows) {
            String id = string(row, "id");
            JsonNode restriction = row.path("restriction");
            JsonNode override = row.path("restrictionOverride");
            JsonNode cancellation = row.path("cancellation");
            JsonNode failure = row.path("ingestFailure");
            dsl.insertInto(ITERATIONS)
                    .set(ITERATIONS.ID, id)
                    .set(ITERATIONS.DOCUMENT_ID, string(row, "documentId"))
                    .set(ITERATIONS.ATTEMPT, row.path("attempt").asInt())
                    .set(ITERATIONS.REQUEST_ID, string(row, "requestId"))
                    .set(ITERATIONS.CATEGORY_ID, string(row, "categoryId"))
                    .set(ITERATIONS.PRIORITY, string(row, "priority"))
                    .set(ITERATIONS.PROJECT_ID, nullableString(row, "projectId"))
                    .set(ITERATIONS.PROGRESS, string(row, "progress"))
                    .set(ITERATIONS.LIST_ID, nullableString(row, "listId"))
                    .set(ITERATIONS.FORMER_LIST_NAME, nullableString(row, "formerListName"))
                    .set(ITERATIONS.RESTRICTION_RULE, nullableString(restriction, "rule"))
                    .set(ITERATIONS.RESTRICTION_PUBLIC_TEXT, nullableString(restriction, "publicText"))
                    .set(ITERATIONS.RESTRICTION_INTERNAL_TEXT, nullableString(restriction, "internalText"))
                    .set(ITERATIONS.RESTRICTION_FOUND_AT, nullableInstant(restriction, "foundAt"))
                    .set(ITERATIONS.OVERRIDE_ACTOR_ID, nullableString(override, "actorId"))
                    .set(ITERATIONS.OVERRIDE_AT, nullableInstant(override, "at"))
                    .set(ITERATIONS.OVERRIDE_NOTE, nullableString(override, "note"))
                    .set(ITERATIONS.CANCELLATION_CAUSE, nullableString(cancellation, "cause"))
                    .set(ITERATIONS.CANCELLATION_ACTOR_ID, nullableString(cancellation, "actorId"))
                    .set(ITERATIONS.CANCELLATION_AT, nullableInstant(cancellation, "at"))
                    .set(ITERATIONS.CANCELLATION_PUBLIC_TEXT, nullableString(cancellation, "publicText"))
                    .set(ITERATIONS.CANCELLATION_INTERNAL_TEXT, nullableString(cancellation, "internalText"))
                    .set(ITERATIONS.INGEST_FAILURE_ATTEMPTS, nullableInteger(failure, "attempts"))
                    .set(ITERATIONS.INGEST_FAILURE_ERROR, nullableString(failure, "error"))
                    .set(ITERATIONS.DIGITIZED_AT, nullableInstant(row, "digitizedAt"))
                    .set(ITERATIONS.SCAN_DPI, nullableInteger(row, "scanDpi"))
                    .execute();
            int position = 0;
            for (JsonNode defect : row.path("defects")) {
                dsl.insertInto(ITERATION_DEFECTS)
                        .set(ITERATION_DEFECTS.ITERATION_ID, id)
                        .set(ITERATION_DEFECTS.POSITION, position++)
                        .set(ITERATION_DEFECTS.KEY, string(defect, "key"))
                        .set(ITERATION_DEFECTS.INSTANCE_ID, string(defect, "instanceId"))
                        .set(ITERATION_DEFECTS.RULE_CODE, string(defect, "ruleCode"))
                        .set(ITERATION_DEFECTS.SUBJECT, string(defect, "subject"))
                        .set(ITERATION_DEFECTS.PUBLIC_TEXT, string(defect, "publicText"))
                        .set(ITERATION_DEFECTS.INTERNAL_TEXT, string(defect, "internalText"))
                        .set(ITERATION_DEFECTS.FIRST_SEEN_AT, instant(defect, "firstSeenAt"))
                        .execute();
            }
            position = 0;
            for (JsonNode verdict : row.path("verdicts")) {
                dsl.insertInto(ITERATION_VERDICTS)
                        .set(ITERATION_VERDICTS.ITERATION_ID, id)
                        .set(ITERATION_VERDICTS.POSITION, position++)
                        .set(ITERATION_VERDICTS.VERDICT, string(verdict, "verdict"))
                        .set(ITERATION_VERDICTS.DEFECT_KEYS, strings(verdict.path("defectKeys")))
                        .set(ITERATION_VERDICTS.ACTOR_ID, string(verdict, "actorId"))
                        .set(ITERATION_VERDICTS.AT, instant(verdict, "at"))
                        .set(ITERATION_VERDICTS.NOTE, string(verdict, "note"))
                        .set(ITERATION_VERDICTS.PUBLIC_TEXT, nullableString(verdict, "publicText"))
                        .execute();
            }
            position = 0;
            for (JsonNode link : row.path("links")) {
                dsl.insertInto(ITERATION_LINKS)
                        .set(ITERATION_LINKS.ITERATION_ID, id)
                        .set(ITERATION_LINKS.POSITION, position++)
                        .set(ITERATION_LINKS.ID, string(link, "id"))
                        .set(ITERATION_LINKS.URL, string(link, "url"))
                        .set(ITERATION_LINKS.INSTANCE_ID, nullableString(link, "instanceId"))
                        .set(ITERATION_LINKS.SET_BY, string(link, "setBy"))
                        .set(ITERATION_LINKS.SET_AT, instant(link, "setAt"))
                        .set(ITERATION_LINKS.IS_PRIMARY, link.path("isPrimary").asBoolean())
                        .execute();
            }
            propertySources(dsl, ITERATION_PROPERTY_SOURCES.ITERATION_ID, id, row.path("properties"));
        }
    }

    private void requests(DSLContext dsl, JsonNode rows) {
        for (JsonNode row : rows) {
            String id = string(row, "id");
            String decision = string(row, "decision");
            JsonNode iteration = row.path("iteration");
            JsonNode rescan = row.path("rescan");
            JsonNode decline = row.path("decline");
            dsl.insertInto(REQUESTS)
                    .set(REQUESTS.ID, id)
                    .set(REQUESTS.DOCUMENT_ID, string(row, "documentId"))
                    .set(REQUESTS.REQUESTER_ID, string(row, "requesterId"))
                    .set(REQUESTS.AT, instant(row, "at"))
                    .set(REQUESTS.REASON, nullableString(row, "reason"))
                    .set(REQUESTS.BATCH_ID, string(row, "batchId"))
                    .set(REQUESTS.PROJECT_ID, nullableString(row, "projectId"))
                    .set(REQUESTS.CHECKED_AT, nullableInstant(row, "checkedAt"))
                    .set(REQUESTS.DECISION, decision)
                    .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, decision.equals("Pending")
                            ? row.path("isAfterProjectApproval").asBoolean() : null)
                    .set(REQUESTS.ITERATION_RELATION, nullableString(iteration, "relation"))
                    .set(REQUESTS.ITERATION_ID, nullableString(iteration, "id"))
                    .set(REQUESTS.RESCAN_ACTOR_ID, nullableString(rescan, "actorId"))
                    .set(REQUESTS.RESCAN_AT, nullableInstant(rescan, "at"))
                    .set(REQUESTS.RESCAN_NOTE, nullableString(rescan, "note"))
                    .set(REQUESTS.DECLINE_ACTOR_ID, nullableString(decline, "actorId"))
                    .set(REQUESTS.DECLINE_AT, nullableInstant(decline, "at"))
                    .set(REQUESTS.DECLINE_PUBLIC_TEXT, nullableString(decline, "publicText"))
                    .set(REQUESTS.DECLINE_INTERNAL_TEXT, nullableString(decline, "internalText"))
                    .set(REQUESTS.WITHDRAWN_AT, nullableInstant(row, "withdrawnAt"))
                    .set(REQUESTS.TRACKS_ITERATION_ID, nullableString(row, "tracksIterationId"))
                    .execute();
            int position = 0;
            for (JsonNode copy : row.path("existingCopies")) {
                dsl.insertInto(REQUEST_EXISTING_COPIES)
                        .set(REQUEST_EXISTING_COPIES.REQUEST_ID, id)
                        .set(REQUEST_EXISTING_COPIES.POSITION, position++)
                        .set(REQUEST_EXISTING_COPIES.SOURCE, string(copy, "source"))
                        .set(REQUEST_EXISTING_COPIES.STATE, string(copy, "state"))
                        .set(REQUEST_EXISTING_COPIES.LINK, nullableString(copy, "link"))
                        .set(REQUEST_EXISTING_COPIES.ITERATION_ID, nullableString(copy, "iterationId"))
                        .set(REQUEST_EXISTING_COPIES.SEEN_AT, instant(copy, "seenAt"))
                        .set(REQUEST_EXISTING_COPIES.FOUND_AFTER_APPROVAL,
                                copy.path("foundAfterApproval").asBoolean())
                        .execute();
            }
        }
    }

    private void events(DSLContext dsl, JsonNode rows) {
        for (JsonNode row : rows) {
            JsonNode actor = row.path("actor");
            JsonNode reason = row.path("reason");
            dsl.insertInto(EVENTS)
                    .set(EVENTS.ID, string(row, "id"))
                    .set(EVENTS.CODE, string(row, "code"))
                    .set(EVENTS.SUBJECT_KIND, string(row, "subjectKind"))
                    .set(EVENTS.SUBJECT_ID, string(row, "subjectId"))
                    .set(EVENTS.AT, instant(row, "at"))
                    .set(EVENTS.ACTOR, JSONB.valueOf(actor.toString()))
                    .set(EVENTS.CORRELATION_ID, string(row, "correlationId"))
                    .set(EVENTS.DATA, JSONB.valueOf(row.path("data").toString()))
                    .set(EVENTS.REASON_PUBLIC,
                            reason.isNull() ? null : nullableString(reason, "public"))
                    .set(EVENTS.REASON_INTERNAL,
                            reason.isNull() ? null : nullableString(reason, "internal"))
                    .execute();
        }
    }

    private <R extends Record> void insertIds(
            DSLContext dsl, Table<R> table, TableField<R, String> ownerField,
            String owner, JsonNode values) {
        int position = 0;
        for (JsonNode value : values) {
            dsl.insertInto(table)
                    .set(ownerField, owner)
                    .set(table.field("position", Integer.class), position++)
                    .set(table.field(table == PROJECT_MEMBERS ? "user_id" :
                            table == PROJECT_MEMBER_GROUPS ? "group_id" :
                            table == REQUEST_CUSTODY_MEMBERS ? "user_id" : "group_id", String.class),
                            value.asString())
                    .execute();
        }
    }

    private <R extends Record> void propertySources(
            DSLContext dsl, TableField<R, String> ownerField, String owner, JsonNode properties) {
        int keyPosition = 0;
        for (JsonNode property : properties) {
            int position = 0;
            for (JsonNode source : property.path("sources")) {
                var table = ownerField.getTable();
                dsl.insertInto(table)
                        .set(ownerField, owner)
                        .set(table.field("key", String.class), string(property, "key"))
                        .set(table.field("key_position", Integer.class), keyPosition)
                        .set(table.field("position", Integer.class), position++)
                        .set(table.field("source", JSONB.class), JSONB.valueOf(source.path("source").toString()))
                        .set(table.field("tier", Integer.class), source.path("tier").asInt())
                        .set(table.field("value", JSONB.class), JSONB.valueOf(source.path("value").toString()))
                        .set(table.field("observed_at", OffsetDateTime.class), instant(source, "observedAt"))
                        .set(table.field("set_by", String.class), nullableString(source, "setBy"))
                        .execute();
            }
            keyPosition++;
        }
    }

    private String string(JsonNode row, String field) {
        return row.path(field).asString();
    }

    private String namesJson(JsonNode row) {
        JsonNode names = row.get("names");
        return names == null || names.isNull()
                ? json.valueToTree(Map.of("en", string(row, "name"))).toString()
                : names.toString();
    }

    private String nullableString(JsonNode row, String field) {
        JsonNode value = row.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private Integer nullableInteger(JsonNode row, String field) {
        JsonNode value = row.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }

    private LocalDate nullableDate(JsonNode row, String field) {
        String value = nullableString(row, field);
        return value == null ? null : LocalDate.parse(value);
    }

    private JSONB nullableJson(JsonNode row, String field) {
        JsonNode value = row.get(field);
        return value == null || value.isNull() ? null : JSONB.valueOf(value.toString());
    }

    private OffsetDateTime nullableInstant(JsonNode row, String field) {
        String value = nullableString(row, field);
        return value == null ? null : timestamp(value);
    }

    private OffsetDateTime instant(JsonNode row, String field) {
        return timestamp(string(row, field));
    }

    private OffsetDateTime timestamp(String value) {
        return Instant.parse(value).atOffset(ZoneOffset.UTC);
    }

    private String[] strings(JsonNode values) {
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            result.add(value.asString());
        }
        return result.toArray(String[]::new);
    }
}
