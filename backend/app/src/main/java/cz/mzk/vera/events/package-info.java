// B9 shared package: Events records durable history, audit and hook events.
@org.springframework.modulith.ApplicationModule(allowedDependencies = {
        "db :: tables", "jobs", "session", "telemetry", "web" })
package cz.mzk.vera.events;
