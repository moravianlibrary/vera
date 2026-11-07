@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "web", "session", "db :: tables", "events", "pluginhost", "jobs"
})
// B9. Login discovery and session read endpoints.
package cz.mzk.vera.login;
