@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "events", "pluginhost", "tasks"
})
// PLG-model; PLG-secrets; PLG-run-items; ACT-instance-create; ACT-instance-save; ACT-instance-disable;
// ACT-instance-delete; ACT-instance-run; ACCESS-last-identity; ACCESS-custody-by-plugins; L8.
package cz.mzk.vera.plugins;
