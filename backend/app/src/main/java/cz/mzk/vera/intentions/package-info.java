@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "documents", "iterations", "session", "web"
})
// PLAN-counting; B9. Stored intentions and mixes for list and project reads.
package cz.mzk.vera.intentions;
