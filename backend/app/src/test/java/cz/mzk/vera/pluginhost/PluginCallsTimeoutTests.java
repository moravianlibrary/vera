package cz.mzk.vera.pluginhost;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PluginCallsTimeoutTests {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void readsInstanceTimeoutAndFallsBackToTenSeconds() {
        assertThat(PluginCalls.configuredTimeout(json.readTree("{\"timeout\":\"2s\"}"), Duration.ofSeconds(10)))
                .isEqualTo(Duration.ofSeconds(2));
        assertThat(PluginCalls.configuredTimeout(json.readTree("{\"timeout\":\"10s\"}"), Duration.ofSeconds(10)))
                .isEqualTo(Duration.ofSeconds(10));
        assertThat(PluginCalls.configuredTimeout(json.readTree("{\"timeout\":\"500ms\"}"), Duration.ofSeconds(10)))
                .isEqualTo(Duration.ofMillis(500));
        assertThat(PluginCalls.configuredTimeout(json.readTree("{}"), Duration.ofSeconds(10)))
                .isEqualTo(Duration.ofSeconds(10));
    }

    @Test
    void twoSecondInstanceIsCutOffAndTenSecondInstanceCanFinishAfterTwoSeconds() throws Exception {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var shortCall = executor.submit(() -> {
                Thread.sleep(5_000);
                return "late";
            });
            long started = System.nanoTime();
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> PluginCalls.await(shortCall,
                    PluginCalls.configuredTimeout(json.readTree("{\"timeout\":\"2s\"}"), Duration.ofSeconds(10))))
                    .isInstanceOf(TimeoutException.class);
            assertThat(Duration.ofNanos(System.nanoTime() - started)).isBetween(
                    Duration.ofSeconds(1), Duration.ofSeconds(4));

            var longCall = executor.submit(() -> {
                Thread.sleep(2_200);
                return "finished";
            });
            assertThat(PluginCalls.await(longCall,
                    PluginCalls.configuredTimeout(json.readTree("{\"timeout\":\"10s\"}"), Duration.ofSeconds(10))))
                    .isEqualTo("finished");
        }
    }
}
