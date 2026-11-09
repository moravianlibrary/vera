plugins { `java-library` }
sourceSets { main { java.srcDir("../wire/src/main/java"); java.srcDir("../generator-wire/src/main/java") } }
dependencies { compileOnly(project(":plugin-api")) }
