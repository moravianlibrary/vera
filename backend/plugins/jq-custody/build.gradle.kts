plugins { `java-library` }

dependencies {
    compileOnly(project(":plugin-api"))
    implementation(libs.jackson.jq)
}

tasks.named<Jar>("jar") {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from({
        configurations.runtimeClasspath.get().filter { it.isFile }.map { zipTree(it) }
    }) {
        exclude("META-INF/MANIFEST.MF", "META-INF/*.SF", "META-INF/*.RSA", "META-INF/*.DSA", "META-INF/*.EC")
    }
}
