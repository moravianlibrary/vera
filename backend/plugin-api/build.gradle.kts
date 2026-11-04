plugins {
    `java-library`
}

dependencies {
    testImplementation(platform(libs.spring.boot.dependencies))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)
}
