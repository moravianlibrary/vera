package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.JacksonException;

/** jOOQ read models for the public login page. */
@Repository
public class LoginQueries {
    private final DSLContext dsl;
    private final ObjectMapper mapper;

    public LoginQueries(DSLContext dsl, ObjectMapper mapper) {
        this.dsl = dsl;
        this.mapper = mapper;
    }

    List<LoginEntry> loginEntries() {
        boolean mail = !dsl.select(PLUGIN_INSTANCES.ID)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .fetch().isEmpty();
        List<OrderedEntry> result = new ArrayList<>();
        dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.CONFIGURATION, PLUGIN_INSTANCES.SETTINGS,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch().forEach(row -> {
                    JsonNode settings = json(row.get(PLUGIN_INSTANCES.SETTINGS));
                    if (!"Identity".equals(settings.path("kind").asString())) return;
                    JsonNode versions = json(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS));
                    JsonNode declares = versions.path(0).path("declares");
                    JsonNode configuration = json(row.get(PLUGIN_INSTANCES.CONFIGURATION));
                    String entry = "Form".equals(declares.path("loginEntry").asString()) ? "form" : "redirect";
                    boolean form = entry.equals("form");
                    LoginEntry loginEntry = new LoginEntry(row.get(PLUGIN_INSTANCES.ID),
                            settings.path("label").asString(), entry,
                            form && mail && "on".equals(configuration.path("signup").asString()), form && mail);
                    result.add(new OrderedEntry(loginEntry, settings.path("order").asInt()));
                });
        return result.stream().sorted(Comparator.comparingInt(OrderedEntry::order))
                .map(OrderedEntry::entry).toList();
    }

    private JsonNode json(Object value) {
        try {
            if (value == null) return mapper.nullNode();
            return mapper.readTree(value.toString());
        } catch (JacksonException exception) {
            throw new IllegalStateException("Invalid JSON stored in plugin settings", exception);
        }
    }

    record LoginEntry(String instanceId, String label, String entry, boolean canSignUp, boolean canResetPassword) {}

    private record OrderedEntry(LoginEntry entry, int order) {}
}
