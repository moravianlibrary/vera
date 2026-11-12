@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "web", "session", "db :: tables", "access", "pluginhost", "documents", "requests", "events", "jobs"
})
// B9. Proposal submissions and their batches.
package cz.mzk.vera.proposals;
