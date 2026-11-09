@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "access", "db :: tables", "documents", "events", "iterations", "session", "web"
})
// PLAN-counting; B9. Stored intentions and mixes for list and project reads.
package cz.mzk.vera.intentions;
