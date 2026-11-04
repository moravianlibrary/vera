allprojects {
    group = "cz.mzk.vera"
    version = "0.1.0-SNAPSHOT"
}

subprojects {
    plugins.withId("java") {
        extensions.configure<JavaPluginExtension> {
            toolchain.languageVersion.set(JavaLanguageVersion.of(25))
        }

        tasks.withType<JavaCompile>().configureEach {
            options.compilerArgs.addAll(listOf("-parameters", "-Xlint:all", "-Werror"))
            options.encoding = "UTF-8"
        }

        tasks.withType<Test>().configureEach {
            useJUnitPlatform()
            environment("VERA_CONTRACT_DIR", rootDir.resolve("../contract").absolutePath)
            environment("VERA_SEEDS_DIR", rootDir.resolve("../engine/seeds").absolutePath)
        }
        tasks.withType<JavaExec>().configureEach {
            if (name == "bootRun") {
                environment("VERA_CONTRACT_DIR", rootDir.resolve("../contract").absolutePath)
                environment("VERA_SEEDS_DIR", rootDir.resolve("../engine/seeds").absolutePath)
            }
        }
    }
}
