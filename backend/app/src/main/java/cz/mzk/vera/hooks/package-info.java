@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "pluginhost", "jobs", "events", "account", "watchlists"
})
// HOOK-model; HOOK-recipient; HOOK-delivery-states; B9.
package cz.mzk.vera.hooks;
