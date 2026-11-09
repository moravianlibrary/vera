pluginManagement {
    repositories {
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "vera-backend"

include("plugin-api", "domain", "app", "testing", "testing:fakes:oidc-identity", "testing:fakes:local-accounts",
    "testing:fakes:aleph-catalog-adapter", "testing:fakes:barcode-reader",
    "testing:fakes:cover-recognition", "testing:fakes:jq-custody",
    "testing:fakes:place-of-publication", "testing:fakes:material-type",
    "testing:fakes:kramerius-registry", "testing:fakes:rdcz-registry",
    "testing:fakes:page-count-predictor", "testing:fakes:catalog-validity",
    "testing:fakes:language-check", "testing:fakes:copyright-rule",
    "testing:fakes:priority-first", "testing:fakes:shelf-advisor")
