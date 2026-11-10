package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.Record1;
import org.jooq.Record3;
import org.jooq.Result;
import org.jooq.JSONB;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// WATCH-delivery; PLG-declares: enabled Delivery instances and the person's configured reach.
@Repository
public class WatchlistChannels {
    private final DSLContext dsl;
    private final ObjectMapper mapper;
    private final IdentityClaims claims;

    public WatchlistChannels(DSLContext dsl, ObjectMapper mapper, IdentityClaims claims) {
        this.dsl = dsl;
        this.mapper = mapper;
        this.claims = claims;
    }

    public List<Map<String, Object>> forPerson(String userId) {
        Record1<String> user = dsl.select(USERS.EMAIL).from(USERS).where(USERS.ID.eq(userId)).fetchOne();
        List<Map<String, Object>> result = new ArrayList<>();
        Result<Record3<String, String, JSONB>> rows = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch();
        for (Record3<String, String, JSONB> row : rows) {
            JsonNode declarations = read(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
            JsonNode version = declarations.path(0);
            JsonNode declares = version.path("declares");
            JsonNode reach = declares.path("personReach");
            if (reach.isMissingNode() || reach.isNull()) {
                continue;
            }
            boolean canReach;
            Map<String, Object> publicReach = new LinkedHashMap<>();
            if ("email".equals(reach.path("by").asString())) {
                canReach = user != null && user.get(USERS.EMAIL) != null;
                publicReach.put("by", "email");
            } else {
                String claim = reach.path("claim").asString();
                canReach = claims.value(userId, claim) != null;
                publicReach.put("by", "claim");
                publicReach.put("claim", claim);
            }
            Map<String, Object> channel = new LinkedHashMap<>();
            channel.put("id", row.get(PLUGIN_INSTANCES.ID));
            channel.put("name", row.get(PLUGIN_INSTANCES.NAME));
            channel.put("reach", publicReach);
            channel.put("canReach", canReach);
            result.add(channel);
        }
        return result;
    }

    private JsonNode read(String data) {
        try {
            return mapper.readTree(data);
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid plugin declaration JSON", exception);
        }
    }
}
