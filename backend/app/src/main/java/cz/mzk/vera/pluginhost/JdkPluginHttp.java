package cz.mzk.vera.pluginhost;

import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

// PLG-api-call.
@AutoConfiguration
public class JdkPluginHttp {
    @Bean
    @ConditionalOnMissingBean(PluginHttp.class)
    PluginHttp pluginHttp() {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        return request -> {
            try {
                HttpRequest.Builder builder = HttpRequest.newBuilder(request.uri())
                        .timeout(Duration.ofSeconds(10));
                request.headers().forEach((key, values) -> values.forEach(value -> builder.header(key, value)));
                byte[] body = request.body() == null ? new byte[0] : request.body();
                builder.method(request.method(), HttpRequest.BodyPublishers.ofByteArray(body));
                HttpResponse<byte[]> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
                Map<String, List<String>> headers = response.headers().map().entrySet().stream()
                        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
                return new PluginHttp.Response(response.statusCode(), headers, response.body());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new PluginUnavailable("Plugin HTTP call interrupted.", exception);
            } catch (Exception exception) {
                throw new PluginUnavailable("Plugin HTTP call did not answer.", exception);
            }
        };
    }
}
