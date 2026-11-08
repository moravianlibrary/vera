package cz.mzk.vera.lists;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// HOOK-list-transitions; EVENT-derived. The stored start day makes earlier queued jobs stale.
@Component
class ListStartJob implements JobKind<Void> {
    private final ListCommands commands;

    ListStartJob(ListCommands commands) {
        this.commands = commands;
    }

    @Override
    public String name() {
        return "list.start";
    }

    @Override
    public Void call(Job job) {
        return null;
    }

    @Override
    public void apply(DSLContext dsl, Job job, Void found) {
        // EVENT-derived; HOOK-list-transitions: send list.started to hooks here when delivery exists.
        commands.startJob(dsl, job.payload().path("listId").asString(),
                job.payload().path("startsOn").asString());
    }
}
