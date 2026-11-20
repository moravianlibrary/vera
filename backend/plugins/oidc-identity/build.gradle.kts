plugins { `java-library` }

dependencies {
    compileOnly(project(":plugin-api"))
    implementation(libs.oauth2.oidc.sdk)
    testImplementation(libs.testcontainers.junit)
    testImplementation("com.github.dasniko:testcontainers-keycloak:3.4.0")
}

tasks.named<Jar>("jar") {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from({
        configurations.runtimeClasspath.get().filter { it.isFile }.map { zipTree(it) }
    }) {
        exclude("META-INF/MANIFEST.MF", "META-INF/*.SF", "META-INF/*.RSA", "META-INF/*.DSA", "META-INF/*.EC")
    }
}
