@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "pluginhost", "jobs", "documents",
    "iterations", "proposals", "requests"
})
// ENT-run, ENT-schedule; the Tasks acts; PLG-run-items; B5, B9.
package cz.mzk.vera.tasks;
