@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "web", "session", "access", "db :: tables", "pluginhost"
})
// B9. The person's settings.
package cz.mzk.vera.account;
