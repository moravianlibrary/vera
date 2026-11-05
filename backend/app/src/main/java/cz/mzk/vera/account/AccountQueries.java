package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.USER_SETTINGS;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// B9. Settings belong to the person and follow them between devices.
@Repository
public class AccountQueries {
    private final DSLContext dsl;
    private final JsonMapper json;

    public AccountQueries(DSLContext dsl, JsonMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public ObjectNode settings(String userId) {
        var row = dsl.selectFrom(USER_SETTINGS).where(USER_SETTINGS.USER_ID.eq(userId)).fetchOne();
        if (row == null) {
            return defaults();
        }
        return (ObjectNode) json.readTree(row.getSettings().data());
    }

    private ObjectNode defaults() {
        ObjectNode settings = json.createObjectNode();
        settings.putObject("lastOpenedWatchlists");
        return settings;
    }
}
