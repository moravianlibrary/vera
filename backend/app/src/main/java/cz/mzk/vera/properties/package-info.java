@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "events", "documents :: property-definitions"
})
// ACT-property-create; ACT-property-save; ACT-property-delete: definition acts and their impact.
package cz.mzk.vera.properties;
