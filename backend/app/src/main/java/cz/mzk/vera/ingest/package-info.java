@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "jobs", "pluginhost", "iterations", "documents", "events"
})
// LC-ITER-ingest; STAT-gates-move-progress; B9.
package cz.mzk.vera.ingest;
