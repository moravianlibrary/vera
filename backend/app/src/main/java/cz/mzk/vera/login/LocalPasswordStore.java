package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.LOCAL_PASSWORDS;

import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.pluginhost.LocalPasswordSource;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-local-account. A plugin can only check the instance selected by PluginCalls.
@Repository
public class LocalPasswordStore implements LocalPasswordSource {
    private final DSLContext dsl;
    private final Passwords passwords;

    public LocalPasswordStore(DSLContext dsl, Passwords passwords) {
        this.dsl = dsl;
        this.passwords = passwords;
    }

    @Override
    public LocalPasswords forInstance(String instanceId) {
        return (username, password) -> check(instanceId, username, password);
    }

    public PasswordCheck check(String instanceId, String username, String password) {
        String hash = dsl.select(LOCAL_PASSWORDS.HASH)
                .from(LOCAL_PASSWORDS)
                .where(LOCAL_PASSWORDS.INSTANCE_ID.eq(instanceId))
                .and(LOCAL_PASSWORDS.USERNAME.eq(username))
                .fetchOne(LOCAL_PASSWORDS.HASH);
        if (hash == null) {
            return PasswordCheck.NONE;
        }
        return passwords.matches(password, hash) ? PasswordCheck.MATCHES : PasswordCheck.DIFFERS;
    }

    public void save(String instanceId, String username, String hash) {
        dsl.insertInto(LOCAL_PASSWORDS)
                .set(LOCAL_PASSWORDS.INSTANCE_ID, instanceId)
                .set(LOCAL_PASSWORDS.USERNAME, username)
                .set(LOCAL_PASSWORDS.HASH, hash)
                .onConflict(LOCAL_PASSWORDS.INSTANCE_ID, LOCAL_PASSWORDS.USERNAME)
                .doUpdate()
                .set(LOCAL_PASSWORDS.HASH, hash)
                .execute();
    }
}
