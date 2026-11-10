package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;

import java.util.List;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// MSG-recipients; WATCH-delivery: read identity claims consistently for channel reach.
@Component
public final class IdentityClaims {
    private final DSLContext dsl;
    private final JsonMapper json;

    public IdentityClaims(DSLContext dsl, JsonMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public String value(String userId, String claimName) {
        if (claimName == null) {
            return null;
        }
        List<JSONB> identities = dsl.select(USER_IDENTITIES.CLAIMS).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.USER_ID.eq(userId)).orderBy(USER_IDENTITIES.POSITION)
                .fetch(USER_IDENTITIES.CLAIMS);
        for (JSONB identityClaims : identities) {
            JsonNode values = json.readTree(identityClaims.data()).get(claimName);
            if (values == null) {
                continue;
            }
            if (values.isArray()) {
                for (JsonNode value : values) {
                    String candidate = value.asString();
                    if (!candidate.isBlank()) {
                        return candidate;
                    }
                }
            } else if (values.isString() && !values.asString().isBlank()) {
                return values.asString();
            }
        }
        return null;
    }
}
