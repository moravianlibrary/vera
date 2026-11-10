@org.springframework.modulith.ApplicationModule(allowedDependencies = {
    "access", "db :: tables", "documents", "pluginhost", "projects", "requests", "session", "web"
})
// MSG-recipients; MSG-keeps-nothing: resolve visible subjects and hand them to Message instances.
package cz.mzk.vera.messages;
