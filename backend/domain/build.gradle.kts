plugins {
    `java-library`
}

// B3's cases are the same inputs used by the TypeScript runner.
tasks.withType<Test>().configureEach {
    systemProperty("vera.domain.cases", rootProject.projectDir.resolve("../domain/cases").canonicalPath)
}

dependencies {
    testImplementation(platform(libs.spring.boot.dependencies))
    testImplementation(libs.jackson.databind)
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)
}
