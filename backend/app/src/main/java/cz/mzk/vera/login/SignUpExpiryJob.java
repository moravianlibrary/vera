package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.PENDING_SIGN_UPS;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// ACCESS-sign-up. Expiry removes only an unused pending sign-up.
@Component
public class SignUpExpiryJob implements JobKind<String> {
    @Override
    public String name() {
        return "sign-up.expire";
    }

    @Override
    public String call(Job job) {
        return job.payload().path("tokenHash").asString();
    }

    @Override
    public void apply(DSLContext dsl, Job job, String found) {
        dsl.deleteFrom(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.TOKEN_HASH.eq(found))
                .and(PENDING_SIGN_UPS.USED_AT.isNull())
                .execute();
    }
}
