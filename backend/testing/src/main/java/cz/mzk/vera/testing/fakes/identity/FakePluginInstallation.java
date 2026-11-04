package cz.mzk.vera.testing.fakes.identity;

import cz.mzk.vera.pluginhost.InstalledPlugins;
import java.io.IOException;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

// The test fakes exercise the same JAR loading path as installed plugins.
@Configuration
@Profile("test")
public class FakePluginInstallation {
    @Bean
    ApplicationRunner installIdentityFakes(InstalledPlugins installed) {
        return args -> {
            installed.install(read("fakes/oidc-identity.jar"));
            installed.install(read("fakes/local-accounts.jar"));
        };
    }

    private byte[] read(String resource) throws IOException {
        try (var stream = FakePluginInstallation.class.getClassLoader().getResourceAsStream(resource)) {
            if (stream == null) throw new IOException("Missing test plugin resource " + resource);
            return stream.readAllBytes();
        }
    }
}
