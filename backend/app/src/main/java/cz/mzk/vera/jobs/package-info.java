// B5. Shared durable job queue and worker.
@org.springframework.modulith.ApplicationModule(allowedDependencies = { "db :: tables", "telemetry" })
package cz.mzk.vera.jobs;
