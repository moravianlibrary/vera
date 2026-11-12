@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "listing", "events", "pluginhost"
})
// B9. Documents writes the stored states derived from document, iteration and request rules.
package cz.mzk.vera.documents;
