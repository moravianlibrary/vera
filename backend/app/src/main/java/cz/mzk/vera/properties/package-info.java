@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "db :: tables", "session", "access", "web", "events", "documents :: property-definitions",
    "documents", "iterations"
})
// ACT-property-create; ACT-property-save; ACT-property-delete; DOC-property-hand: property acts.
package cz.mzk.vera.properties;
