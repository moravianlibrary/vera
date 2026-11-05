package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.USER_SETTINGS;

import java.util.List;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// B9. Each named setting merges at its contract boundary.
@Service
public class AccountCommands {
    private static final List<String> SECTION_BOARDS = List.of("projects", "intentions");

    private final DSLContext dsl;
    private final AccountQueries queries;
    private final JsonMapper json;

    public AccountCommands(DSLContext dsl, AccountQueries queries, JsonMapper json) {
        this.dsl = dsl;
        this.queries = queries;
        this.json = json;
    }

    @Transactional
    public ObjectNode patch(String userId, JsonNode change) {
        ObjectNode current = queries.settings(userId);
        ObjectNode updated = settingsAfter(current, (ObjectNode) change);
        dsl.insertInto(USER_SETTINGS).set(USER_SETTINGS.USER_ID, userId)
            .set(USER_SETTINGS.SETTINGS, JSONB.valueOf(updated.toString()))
            .onConflict(USER_SETTINGS.USER_ID).doUpdate()
            .set(USER_SETTINGS.SETTINGS, JSONB.valueOf(updated.toString()))
            .execute();
        return updated;
    }

    ObjectNode settingsAfter(ObjectNode current, ObjectNode change) {
        ObjectNode merged = current.deepCopy();
        merged.setAll(change);
        ObjectNode views = object(current, "lastOpenedWatchlists");
        views.setAll(object(change, "lastOpenedWatchlists"));
        merged.set("lastOpenedWatchlists", views);
        mergeNamed(current, change, merged, "fixedOpeningWatchlists");
        if (change.has("openSections")) {
            ObjectNode boards = json.createObjectNode();
            ObjectNode oldBoards = object(current, "openSections");
            ObjectNode changedBoards = object(change, "openSections");
            for (String board : SECTION_BOARDS) {
                ObjectNode sections = object(oldBoards, board);
                sections.setAll(object(changedBoards, board));
                if (!sections.isEmpty()) {
                    boards.set(board, sections);
                }
            }
            merged.set("openSections", boards);
        }
        if (change.has("notifications")) {
            ObjectNode before = object(current, "notifications");
            ObjectNode after = object(change, "notifications");
            ObjectNode notifications = before.deepCopy();
            JsonNode doNotSend = after.get("doNotSend");
            if (doNotSend == null) {
                doNotSend = before.get("doNotSend");
            }
            notifications.set("doNotSend", doNotSend == null ? json.valueToTree(false) : doNotSend);
            ObjectNode hooks = object(before, "hooks");
            hooks.setAll(object(after, "hooks"));
            notifications.set("hooks", hooks);
            copyIfPresent(after, notifications, "channelsOff");
            copyIfPresent(after, notifications, "noHookEmail");
            merged.set("notifications", notifications);
        }
        return merged;
    }

    private void mergeNamed(ObjectNode current, ObjectNode change, ObjectNode merged, String key) {
        if (!change.has(key)) {
            return;
        }
        ObjectNode result = object(current, key);
        result.setAll(object(change, key));
        merged.set(key, result);
    }

    private void copyIfPresent(ObjectNode source, ObjectNode target, String key) {
        JsonNode value = source.get(key);
        if (value != null) {
            target.set(key, value);
        }
    }

    private ObjectNode object(ObjectNode source, String key) {
        JsonNode node = source.get(key);
        if (node instanceof ObjectNode object) {
            return object.deepCopy();
        }
        return json.createObjectNode();
    }
}
