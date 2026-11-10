import java.util.jar.Attributes
import java.util.jar.JarEntry
import java.util.jar.JarFile
import java.util.jar.JarOutputStream
import java.util.jar.Manifest

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
    "language-check", "copyright-rule", "priority-first", "shelf-advisor",
    "harvester-periodical-gaps", "harvester-kramerius", "publication-detector", "smtp-mailer",
    "mailgun-mailer", "slack-notifier", "http-webhook", "sftp-drop", "mailto-message",
    "slack-message", "slack-bot-message",
)

val pluginPackages = layout.buildDirectory.dir("plugin-packages")
val packageKey = rootProject.file("testing/src/main/resources/test-plugin-key.p12")
tasks.register("pluginPackages") {
    dependsOn(":testing:fakes:catalog-validity:jar", ":testing:fakes:kramerius-registry:jar")
    outputs.dir(pluginPackages)
    doLast {
        val outputDir = pluginPackages.get().asFile
        outputDir.mkdirs()
        fun packageJar(source: File?, output: File, version: String?, rules: String? = null) {
            val manifest = Manifest().apply {
                mainAttributes[Attributes.Name.MANIFEST_VERSION] = "1.0"
            }
            JarOutputStream(output.outputStream(), manifest).use { jarOut ->
                if (source != null) {
                    JarFile(source).use { jarIn ->
                        val entries = jarIn.entries()
                        while (entries.hasMoreElements()) {
                            val entry = entries.nextElement()
                            if (entry.name.equals("META-INF/MANIFEST.MF", true)) continue
                            val bytes = jarIn.getInputStream(entry).use { it.readBytes() }
                            val content = if (entry.name == "META-INF/vera-plugin.json") {
                                var text = bytes.decodeToString()
                                if (version != null) {
                                    text = Regex(""""version"\s*:\s*"[^"]+"""")
                                        .replace(text, """"version": "$version"""")
                                }
                                if (rules != null) {
                                    text = Regex(""""rules"\s*:\s*\[.*?\]""", RegexOption.DOT_MATCHES_ALL)
                                        .replace(text) { """"rules": $rules""" }
                                }
                                text = Regex(""""triggers"\s*:\s*\[.*?\]""", RegexOption.DOT_MATCHES_ALL)
                                    .replace(text) {
                                        """"triggers": ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"]"""
                                    }
                                text.encodeToByteArray()
                            } else bytes
                            jarOut.putNextEntry(JarEntry(entry.name))
                            jarOut.write(content)
                            jarOut.closeEntry()
                        }
                    }
                } else {
                    jarOut.putNextEntry(JarEntry("META-INF/unknown-package.txt"))
                    jarOut.write("signed package without a VERA descriptor".encodeToByteArray())
                    jarOut.closeEntry()
                }
            }
            val signer = ProcessBuilder("jarsigner", "-keystore", packageKey.absolutePath, "-storetype", "PKCS12",
                "-storepass", "changeit", "-keypass", "changeit", output.absolutePath, "vera-test-plugin")
                .inheritIO().start()
            check(signer.waitFor() == 0) { "jarsigner failed for ${output.name}" }
        }
        val catalog = project(":testing:fakes:catalog-validity").tasks.named<Jar>("jar").get().archiveFile.get().asFile
        val registry = project(":testing:fakes:kramerius-registry").tasks.named<Jar>("jar").get().archiveFile.get().asFile
        packageJar(catalog, outputDir.resolve("catalog-validity-3.1.0.jar"), "3.1.0",
            """[{"code":"R03","label":"title well-formed"},{"code":"R07","label":"publication year resolvable"},{"code":"R11","label":"extent matches what was delivered","reads":["page_count"]}]""")
        packageJar(catalog, outputDir.resolve("catalog-validity-3.2.0.jar"), "3.2.0",
            """[{"code":"R03","label":"title well-formed"},{"code":"R07","label":"publication year resolvable"},{"code":"R12","label":"shelf mark present"}]""")
        packageJar(registry, outputDir.resolve("kramerius-registry-1.9.0.jar"), "1.9.0")
        packageJar(null, outputDir.resolve("unknown-plugin.jar"), null)
    }
}

tasks.named<Test>("test") {
    dependsOn("pluginPackages")
}

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
