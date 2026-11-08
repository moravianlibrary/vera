@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "web", "session", "access", "intentions", "documents", "requests", "iterations", "events"
})
// VIEW-projects; PROJECT-review: serve the overview and detail from stored project data.
package cz.mzk.vera.projects;
