plugins {
    `java-library`
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(project(":app"))
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


tasks.named<ProcessResources>("processResources") {
    dependsOn(project(":testing:fakes:oidc-identity").tasks.named("jar"))
    dependsOn(project(":testing:fakes:local-accounts").tasks.named("jar"))
    from(project(":testing:fakes:oidc-identity").tasks.named("jar")) { into("fakes"); rename { "oidc-identity.jar" } }
    from(project(":testing:fakes:local-accounts").tasks.named("jar")) { into("fakes"); rename { "local-accounts.jar" } }
}
