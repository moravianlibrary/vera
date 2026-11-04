package cz.mzk.vera.web;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** Refuses to start when an API handler is not represented by an OpenAPI operation. */
@Configuration
public class RouteCheck {
    private volatile List<String> servedOperationIds = List.of();

    public List<String> servedOperationIds() {
        return servedOperationIds;
    }

    @Bean
    public SmartInitializingSingleton verifyApiRoutes(
            @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings,
            ContractFilter contract) {
        return () -> {
            List<String> served = new ArrayList<>();
            mappings.getHandlerMethods().forEach((info, handler) -> {
                for (String pattern : info.getPatternValues()) {
                    if (!pattern.startsWith("/api/")) continue;
                    for (var method : info.getMethodsCondition().getMethods()) {
                        String template = pattern.substring(4);
                        if (!contract.hasOperation(method.name(), template)) {
                            throw new IllegalStateException(
                                    "Uncontracted route " + handler + " maps " + method + " " + pattern);
                        }
                        served.add(contract.operationId(method.name(), template));
                    }
                }
            });
            servedOperationIds = served.stream().distinct().sorted().toList();
        };
    }
}
