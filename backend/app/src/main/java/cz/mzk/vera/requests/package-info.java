@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "pluginhost", "documents", "listing", "session", "access", "events", "web"
})
// BK3; ACCESS-custody-by-plugins.
package cz.mzk.vera.requests;
