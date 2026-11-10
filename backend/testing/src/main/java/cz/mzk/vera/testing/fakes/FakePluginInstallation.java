package cz.mzk.vera.testing.fakes;

import cz.mzk.vera.pluginhost.InstalledPlugins;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

// The test fakes exercise the same JAR loading path as installed plugins.
@Configuration
@Profile("test")
public class FakePluginInstallation {
    @Bean
    ApplicationRunner installFakes(InstalledPlugins installed) {
        return args -> {
            installed.install(read("fakes/oidc-identity.jar"));
            installed.install(read("fakes/local-accounts.jar"));
            installed.install(read("fakes/aleph-catalog-adapter.jar"));
            installed.install(read("fakes/barcode-reader.jar"));
            installed.install(read("fakes/cover-recognition.jar"));
            installed.install(read("fakes/jq-custody.jar"));
            installed.install(read("fakes/place-of-publication.jar"));
            installed.install(read("fakes/material-type.jar"));
            installed.install(read("fakes/kramerius-registry.jar"));
            installed.install(read("fakes/rdcz-registry.jar"));
            installed.install(read("fakes/page-count-predictor.jar"));
            installed.install(read("fakes/catalog-validity.jar"));
            installed.install(read("fakes/language-check.jar"));
            installed.install(read("fakes/copyright-rule.jar"));
            installed.install(read("fakes/priority-first.jar"));
            installed.install(read("fakes/shelf-advisor.jar"));
            installed.install(read("fakes/harvester-periodical-gaps.jar"));
            installed.install(read("fakes/harvester-kramerius.jar"));
            installed.install(read("fakes/publication-detector.jar"));
            installed.install(read("fakes/smtp-mailer.jar"));
            installed.install(read("fakes/mailgun-mailer.jar"));
            installed.install(read("fakes/slack-notifier.jar"));
            installed.install(read("fakes/http-webhook.jar"));
            installed.install(read("fakes/sftp-drop.jar"));
            installed.install(read("fakes/mailto-message.jar"));
            installed.install(read("fakes/slack-message.jar"));
            installed.install(read("fakes/slack-bot-message.jar"));
        };
    }

    private byte[] read(String resource) throws IOException {
        try (InputStream stream = FakePluginInstallation.class.getClassLoader().getResourceAsStream(resource)) {
            if (stream == null) {
                throw new IOException("Missing test plugin resource " + resource);
            }
            return stream.readAllBytes();
        }
    }
}
