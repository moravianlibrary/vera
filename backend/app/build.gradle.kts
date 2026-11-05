plugins {
    java
    alias(libs.plugins.spring.boot)
}

val codegen = sourceSets.create("codegen")

configurations[codegen.implementationConfigurationName].extendsFrom(configurations.testRuntimeClasspath.get())
dependencies {
    add(codegen.implementationConfigurationName, libs.jooq.codegen)
    add(codegen.implementationConfigurationName, libs.jooq.meta)
    add(codegen.implementationConfigurationName, libs.testcontainers.postgresql)
    add(codegen.implementationConfigurationName, libs.liquibase.core)
    add(codegen.implementationConfigurationName, libs.postgresql)
}

val generateJooq = tasks.register<JavaExec>("generateJooq") {
    val changelogResources = file("src/main/resources")
    dependsOn(codegen.classesTaskName)
    classpath = codegen.runtimeClasspath
    mainClass = "cz.mzk.vera.codegen.GenerateJooq"
    args(layout.buildDirectory.dir("generated-sources/jooq").get().asFile.absolutePath,
        changelogResources.absolutePath, "db/changelog/db.changelog-master.yaml")
    inputs.dir(changelogResources)
    outputs.dir(layout.buildDirectory.dir("generated-sources/jooq"))
}

sourceSets.main { java.srcDir(layout.buildDirectory.dir("generated-sources/jooq")) }
tasks.named("compileJava") { dependsOn(generateJooq) }

dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(platform(libs.spring.modulith.bom))
    implementation(libs.spring.boot.starter.webmvc)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.boot.starter.jdbc)
    implementation(libs.spring.boot.starter.liquibase)
    implementation(libs.spring.boot.starter.jooq)
    implementation(libs.spring.security.crypto)
    implementation(libs.bcprov)
    implementation(libs.spring.modulith.api)
    implementation(libs.json.schema.validator)
    runtimeOnly(libs.postgresql)
    implementation(project(":plugin-api"))
    implementation(project(":domain"))

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.webmvc.test)
    testImplementation(libs.spring.boot.resttestclient)
    testImplementation(libs.spring.modulith.starter.test)
    testImplementation(libs.spring.boot.testcontainers)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.testcontainers.junit)
}
