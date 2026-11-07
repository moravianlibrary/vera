plugins {
    `java-library`
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(project(":app"))
    implementation(project(":domain"))
    implementation(project(":plugin-api"))
    implementation(libs.spring.boot.starter.webmvc)
    implementation(libs.spring.boot.starter.jdbc)
    implementation(libs.spring.boot.starter.liquibase)
    implementation(libs.spring.boot.starter.jooq)
    compileOnly(libs.jakarta.xml.bind.api)
    implementation(libs.json.schema.validator)
    runtimeOnly(libs.postgresql)
    testImplementation(project(":domain"))
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.webmvc.test)
    testImplementation(libs.spring.boot.resttestclient)
    testImplementation(libs.spring.boot.testcontainers)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.testcontainers.junit)
    testRuntimeOnly(libs.junit.platform.launcher)
}


val fakeNames = listOf(
    "oidc-identity", "local-accounts", "aleph-catalog-adapter", "barcode-reader",
    "cover-recognition", "jq-custody", "place-of-publication", "material-type",
    "kramerius-registry", "rdcz-registry", "page-count-predictor", "catalog-validity",
    "language-check", "copyright-rule",
)

tasks.named<ProcessResources>("processResources") {
    fakeNames.forEach { name ->
        val fakeJar = project(":testing:fakes:$name").tasks.named("jar")
        dependsOn(fakeJar)
        from(fakeJar) {
            into("fakes")
            rename { "$name.jar" }
        }
    }
}
