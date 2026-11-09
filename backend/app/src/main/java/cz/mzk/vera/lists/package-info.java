@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "access", "db :: tables", "documents", "events", "intentions", "iterations", "listing",
    "session", "web", "jobs", "pluginhost"
})
// LC-LIST-state; LC-LIST-pool; PLAN-counting; B9.
package cz.mzk.vera.lists;
