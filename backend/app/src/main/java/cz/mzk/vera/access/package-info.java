@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "web", "session", "db :: tables"
})
// B9. Users & Groups.
package cz.mzk.vera.access;
