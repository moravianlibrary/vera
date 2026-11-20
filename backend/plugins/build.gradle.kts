import java.util.jar.JarFile

plugins {
    base
}

val catalogs = extensions.getByType<VersionCatalogsExtension>().named("libs")

subprojects {
    apply(plugin = "java-library")

    dependencies {
        add("compileOnly", project(":plugin-api"))
        add("testImplementation", project(":plugin-api"))
        add("testImplementation", platform(catalogs.findLibrary("spring-boot-dependencies").get()))
        add("testImplementation", catalogs.findLibrary("junit-jupiter").get())
        add("testRuntimeOnly", catalogs.findLibrary("junit-platform-launcher").get())
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
    }
}

val packageOutput = layout.buildDirectory.dir("packages")
val packages = tasks.register("packages") {
    dependsOn(subprojects.map { it.tasks.named("jar") })
    // The signed copies follow the JARs: without inputs Gradle kept stale packages up to date.
    inputs.files(subprojects.map { it.tasks.named("jar") })
    outputs.dir(packageOutput)
    doLast {
        val output = packageOutput.get().asFile
        output.mkdirs()
        val configuredKey = providers.environmentVariable("VERA_PLUGIN_KEYSTORE").orNull
        val keystore = configuredKey?.let(::file)
            ?: rootProject.file("testing/src/main/resources/test-plugin-key.p12")
        val storePassword = providers.environmentVariable("VERA_PLUGIN_KEYSTORE_PASSWORD").orNull ?: "changeit"
        val keyPassword = providers.environmentVariable("VERA_PLUGIN_KEY_PASSWORD").orNull ?: storePassword
        val alias = providers.environmentVariable("VERA_PLUGIN_KEY_ALIAS").orNull ?: "vera-test-plugin"

        subprojects.forEach { plugin ->
            val jar = plugin.tasks.named<Jar>("jar").get().archiveFile.get().asFile
            val descriptor = JarFile(jar).use { archive ->
                archive.getInputStream(archive.getJarEntry("META-INF/vera-plugin.json"))
                    .bufferedReader().readText()
            }
            val slug = Regex("\"implementation\"\\s*:\\s*\"cz\\.mzk\\.vera\\.([^\"]+)\"")
                .find(descriptor)?.groupValues?.get(1)
                ?: error("No implementation descriptor in ${jar.name}")
            val version = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"")
                .find(descriptor)?.groupValues?.get(1)
                ?: error("No version in ${jar.name}")
            val target = output.resolve("$slug-$version.jar")
            jar.copyTo(target, overwrite = true)
            // A configured key's passwords stay in the environment, never on a command line.
            val passwords = if (configuredKey == null) {
                listOf("-storepass", storePassword, "-keypass", keyPassword)
            } else {
                listOf("-storepass:env", "VERA_PLUGIN_KEYSTORE_PASSWORD", "-keypass:env",
                    if (providers.environmentVariable("VERA_PLUGIN_KEY_PASSWORD").isPresent) "VERA_PLUGIN_KEY_PASSWORD"
                    else "VERA_PLUGIN_KEYSTORE_PASSWORD")
            }
            val signer = ProcessBuilder(
                listOf("jarsigner", "-keystore", keystore.absolutePath, "-storetype", "PKCS12") + passwords
                    + listOf(target.absolutePath, alias),
            ).inheritIO().start()
            check(signer.waitFor() == 0) { "jarsigner failed for ${target.name}" }
        }
    }
}

tasks.named("assemble") {
    dependsOn(packages)
}
