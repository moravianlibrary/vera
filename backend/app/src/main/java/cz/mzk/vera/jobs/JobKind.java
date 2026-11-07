package cz.mzk.vera.jobs;

import org.jooq.DSLContext;

// B5. Calls happen outside a transaction; applying their answer happens in one short transaction.
public interface JobKind<T> {
    String name();

    T call(Job job) throws Exception;

    void apply(DSLContext dsl, Job job, T found) throws Exception;
}
