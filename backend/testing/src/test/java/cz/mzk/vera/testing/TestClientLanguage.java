package cz.mzk.vera.testing;

import org.springframework.boot.resttestclient.autoconfigure.RestTestClientBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// UI-language: tests ask in English, as the recordings do; a test that wants Czech says so.
@Configuration(proxyBeanMethods = false)
class TestClientLanguage {
    @Bean
    RestTestClientBuilderCustomizer englishByDefault() {
        return builder -> builder.defaultHeader("Accept-Language", "en");
    }
}
