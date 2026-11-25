package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static org.jooq.impl.DSL.count;

import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldAccess;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// DOC-identifiers; ROLE-library-day: report proposal settings and role-based limits.
@Repository
public class ProposalSettings {
    private static final ZoneId LIBRARY_ZONE = ZoneId.of("Europe/Prague");
    private static final List<String> IDENTIFIER_TYPES =
            List.of("catalogId", "nbn", "isbn", "issn", "barcode", "shelfMark");
    private static final Map<String, Map<String, String>> LABELS = Map.of(
            "catalogId", Map.of("en", "Catalog ID", "cs", "Systémové číslo"),
            "nbn", Map.of("en", "NBN", "cs", "ČNB"),
            "isbn", Map.of("en", "ISBN", "cs", "ISBN"),
            "issn", Map.of("en", "ISSN", "cs", "ISSN"),
            "barcode", Map.of("en", "Barcode", "cs", "Čárový kód"),
            "shelfMark", Map.of("en", "Shelf mark", "cs", "Signatura"));
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final ProposalPluginQueries plugins;
    private final Clock clock;
    private final JsonMapper mapper;
    public ProposalSettings(DSLContext dsl, HeldAccessQueries access, ProposalPluginQueries plugins,
            Clock clock, JsonMapper mapper) {
        this.dsl = dsl;
        this.access = access;
        this.plugins = plugins;
        this.clock = clock;
        this.mapper = mapper;
    }

    public Map<String, Object> settings(String userId) {
        HeldAccess held = access.heldBy(userId);
        List<Map<String, Object>> instances = plugins.instances();
        List<Map<String, Object>> implementations = plugins.implementations();
        Map<String, Map<String, Object>> implementationById = new LinkedHashMap<>();
        implementations.forEach(row -> implementationById.put((String) row.get("id"), row));
        List<Map<String, Object>> adapters = instances.stream()
                .filter(row -> plugins.enabled(row)
                        && plugins.kindOf(row, implementationById).equals(ProposalCodes.CATALOG_ADAPTER))
                .toList();
        List<Map<String, Object>> searchable = adapters.stream()
                .filter(row -> plugins.searchable(row, implementationById))
                .filter(row -> !"off".equals(plugins.configuration(row).get("search")))
                .map(row -> plugins.named(row, false)).toList();
        List<Map<String, Object>> links = adapters.stream().map(row -> plugins.named(row, true)).toList();
        List<Map<String, Object>> entrySources = instances.stream()
                .filter(row -> plugins.enabled(row)
                        && plugins.kindOf(row, implementationById).equals(ProposalCodes.INPUT))
                .filter(row -> plugins.declares(row, implementationById, ProposalCodes.ENTRY))
                .map(row -> {
                    Map<String, Object> value = plugins.named(row, false);
                    value.put("allowedOrigins", split(plugins.configuration(row).getOrDefault("allowed_origins", "")));
                    return value;
                }).toList();
        boolean detect = instances.stream().anyMatch(row -> plugins.enabled(row)
                && plugins.kindOf(row, implementationById).equals(ProposalCodes.IDENTIFIER));
        boolean barcode = instances.stream().anyMatch(row -> plugins.enabled(row)
                && plugins.kindOf(row, implementationById).equals(ProposalCodes.INPUT)
                && plugins.declares(row, implementationById, ProposalCodes.READ_BARCODE));
        // ACT-ways-in: in the order of Plugins, the first reading a photo unless another is picked.
        List<Map<String, Object>> photoReaders = instances.stream().filter(row -> plugins.enabled(row)
                && plugins.kindOf(row, implementationById).equals(ProposalCodes.INPUT)
                && plugins.declares(row, implementationById, ProposalCodes.READ_PHOTO))
                .map(row -> plugins.named(row, false)).toList();
        List<Map<String, Object>> identifiers = identifierTypes(instances, implementationById);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("maxAtOnce", limit(held, "proposal_batch_limit"));
        result.put("canDetectTypes", detect);
        result.put("searchCatalogs", searchable);
        result.put("linkCatalogs", links);
        result.put("entrySources", entrySources);
        result.put("canScanWithCamera", barcode);
        result.put("photoReaders", photoReaders);
        result.put("identifierTypes", identifiers);
        return result;
    }

    public Map<String, Object> rateLimit(String userId) {
        Integer limit = limit(access.heldBy(userId), "proposal_daily_limit");
        if (limit == null) {
            Map<String, Object> unlimited = new LinkedHashMap<>();
            unlimited.put("perDay", null);
            return unlimited;
        }
        int used = submittedToday(userId);
        return Map.of("perDay", Math.max(0, limit - used));
    }

    public boolean canSubmitRateLimited(String userId, int count) {
        Integer limit = limit(access.heldBy(userId), "proposal_daily_limit");
        return limit == null || submittedToday(userId) + count <= limit;
    }

    public Integer proposalLimitOf(String userId) {
        return limit(access.heldBy(userId), "proposal_batch_limit");
    }

    private int submittedToday(String userId) {
        LocalDate today = clock.instant().atZone(LIBRARY_ZONE).toLocalDate();
        var start = today.atStartOfDay(LIBRARY_ZONE).toOffsetDateTime();
        var end = today.plusDays(1).atStartOfDay(LIBRARY_ZONE).toOffsetDateTime();
        Integer used = dsl.select(count()).from(REQUESTS)
                .where(REQUESTS.REQUESTER_ID.eq(userId))
                .and(REQUESTS.AT.ge(start))
                .and(REQUESTS.AT.lt(end))
                .fetchOne(0, Integer.class);
        return used == null ? 0 : used;
    }

    private Integer limit(HeldAccess held, String column) {
        if (held.roleIds().isEmpty()) {
            return 0;
        }
        var rows = dsl.select(ROLES.field(column, Integer.class)).from(ROLES)
                .join(ROLE_GRANTS).on(ROLE_GRANTS.ROLE_ID.eq(ROLES.ID))
                .where(ROLES.ID.in(held.roleIds()))
                .and(ROLE_GRANTS.PERMISSION.eq(ProposalCodes.REQUEST_CREATE))
                .fetch(ROLES.field(column, Integer.class));
        if (rows.contains(null)) {
            return null;
        }
        return Math.max(0, rows.stream().filter(Objects::nonNull).mapToInt(Integer::intValue)
                .max().orElse(0));
    }

    private List<Map<String, Object>> identifierTypes(List<Map<String, Object>> instances,
            Map<String, Map<String, Object>> implementations) {
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> named = new LinkedHashSet<>();
        for (Map<String, Object> instance : instances) {
            if (!plugins.enabled(instance)
                    || !plugins.kindOf(instance, implementations).equals(ProposalCodes.IDENTIFIER)) {
                continue;
            }
            Map<String, String> config = plugins.configuration(instance);
            String type = config.get("type");
            if (type == null || !IDENTIFIER_TYPES.contains(type)) {
                continue;
            }
            Map<String, Object> rule = new LinkedHashMap<>();
            rule.put("type", type);
            rule.put("labels", Map.of("en", config.getOrDefault("label_en", LABELS.get(type).get("en")),
                    "cs", config.getOrDefault("label_cs", LABELS.get(type).get("cs"))));
            boolean pattern = "Pattern".equals(implementations.get(instance.get("implementationId")).get("name"));
            if (pattern) {
                Map<String, Object> recogniser = new LinkedHashMap<>();
                recogniser.put("pattern", config.getOrDefault("pattern", ""));
                recogniser.put("normalisation", splitComma(config.get("normalisation")));
                recogniser.put("checksum", config.get("checksum"));
                rule.put("recogniser", recogniser);
            } else {
                rule.put("recogniser", null);
            }
            result.add(rule);
            named.add(type);
        }
        for (String type : IDENTIFIER_TYPES) {
            if (!named.contains(type)) {
                Map<String, Object> unnamed = new LinkedHashMap<>();
                unnamed.put("type", type);
                unnamed.put("labels", LABELS.get(type));
                unnamed.put("recogniser", null);
                result.add(unnamed);
            }
        }
        return result;
    }

    private List<String> split(String value) {
        return Arrays.stream(value.split("\\s+")).filter(part -> !part.isBlank()).toList();
    }

    private List<String> splitComma(String value) {
        return value == null ? List.of() : Arrays.stream(value.split(","))
                .map(String::trim).filter(part -> !part.isEmpty()).toList();
    }
}
