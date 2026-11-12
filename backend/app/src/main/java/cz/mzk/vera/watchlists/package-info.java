@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "web", "session", "access", "db :: tables", "events", "account", "documents", "requests",
    "lists", "validations", "projects", "categories", "mixes", "intentions", "tasks", "jobs",
    "pluginhost"
})
// WATCH-model; WATCH-audience; WATCH-new; WATCH-delivery; B9.
package cz.mzk.vera.watchlists;
