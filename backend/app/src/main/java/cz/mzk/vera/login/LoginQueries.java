package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-login-page; ACCESS-local-account.
@Repository
public class LoginQueries {
    private final IdentityInstances instances;
    private final DSLContext dsl;

    public LoginQueries(IdentityInstances instances, DSLContext dsl) {
        this.instances = instances;
        this.dsl = dsl;
    }

    public Optional<LocalPerson> localPerson(String instanceId, String username) {
        var person = dsl.select(USERS.NAME, USERS.EMAIL)
                .from(USER_IDENTITIES)
                .join(USERS).on(USER_IDENTITIES.USER_ID.eq(USERS.ID))
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(username))
                .and(USERS.KIND.eq("person"))
                .fetchOne();
        if (person == null) {
            return Optional.empty();
        }
        return Optional.of(new LocalPerson(person.get(USERS.NAME), person.get(USERS.EMAIL)));
    }

    List<LoginEntry> loginEntries() {
        boolean mail = !dsl.select(PLUGIN_INSTANCES.ID)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .fetch().isEmpty();
        return instances.all().stream().map(instance -> {
            boolean form = instance.entry().equals("form");
            return new LoginEntry(instance.id(), instance.settings().label(), instance.entry(),
                    form && mail && "on".equals(instance.configuration().path("signup").asString()), form && mail);
        }).toList();
    }

    record LoginEntry(String instanceId, String label, String entry, boolean canSignUp, boolean canResetPassword) {}

    public record LocalPerson(String name, String email) {}

}
