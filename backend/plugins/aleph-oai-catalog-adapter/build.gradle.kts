plugins { `java-library` }

dependencies {
    compileOnly(project(":plugin-api"))
    testImplementation(libs.spring.boot.starter.test)
}

tasks.withType<Test>().configureEach {
    systemProperty("vera.recorded.dir", rootProject.file("plugins/recorded").absolutePath)
}
