package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import java.util.Comparator;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACCESS-login-page; ACCESS-identity-instance.
@Repository
public class IdentityInstances {
    private final DSLContext dsl;
    private final ObjectMapper mapper;

    public IdentityInstances(DSLContext dsl, ObjectMapper mapper) {
        this.dsl = dsl;
        this.mapper = mapper;
    }

    public List<Instance> all() {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.IMPLEMENTATION_ID,
                        PLUGIN_INSTANCES.CONFIGURATION, PLUGIN_INSTANCES.SETTINGS, PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch().stream().map(row -> {
                    JsonNode settings = read(row.get(PLUGIN_INSTANCES.SETTINGS));
                    if (!"Identity".equals(settings.path("kind").asString())) return null;
                    JsonNode declaration = read(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS)).path(0).path("declares");
                    JsonNode rawMappings = settings.path("mappings");
                    List<Mapping> mappings = rawMappings.isArray() ? rawMappings.valueStream()
                            .map(item -> new Mapping(item.path("claim").asString(), item.path("roleId").asString()))
                            .toList() : List.of();
                    Settings values = new Settings(settings.path("label").asString(), settings.path("order").asInt(),
                            settings.path("userIdClaim").asString(), nullable(settings.path("defaultRoleId")),
                            settings.path("matchByEmail").asBoolean(false), mappings);
                    return new Instance(row.get(PLUGIN_INSTANCES.ID), row.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID),
                            "Form".equals(declaration.path("loginEntry").asString()) ? "form" : "redirect",
                            read(row.get(PLUGIN_INSTANCES.CONFIGURATION)), values);
                }).filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparingInt(instance -> instance.settings().order())).toList();
    }

    public Instance find(String id) {
        return all().stream().filter(instance -> instance.id().equals(id)).findFirst().orElse(null);
    }

    private JsonNode read(Object value) {
        try {
            return value == null ? mapper.nullNode() : mapper.readTree(value.toString());
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid JSON stored in Identity instance", exception);
        }
    }

    private static String nullable(JsonNode node) {
        return node.isMissingNode() || node.isNull() ? null : node.asString();
    }

    public record Instance(String id, String implementationId, String entry, JsonNode configuration, Settings settings) {}
    public record Settings(String label, int order, String userIdClaim, String defaultRoleId,
            boolean matchByEmail, List<Mapping> mappings) {}
    public record Mapping(String claim, String roleId) {}
}
