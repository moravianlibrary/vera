package cz.mzk.vera.session;

import static cz.mzk.vera.db.tables.Tables.USERS;

import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// ACT-local-account: user IDs share the sequence used by first login.
@Component
public class UserIds {
    private final DSLContext dsl;

    public UserIds(DSLContext dsl) {
        this.dsl = dsl;
    }

    public String next() {
        int max = dsl.select(USERS.ID).from(USERS).fetch(USERS.ID).stream()
                .filter(id -> id.matches("u[0-9]+"))
                .mapToInt(id -> Integer.parseInt(id.substring(1))).max().orElse(0);
        return "u" + (max + 1);
    }
}
