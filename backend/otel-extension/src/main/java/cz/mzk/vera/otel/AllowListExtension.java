package cz.mzk.vera.otel;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizer;
import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.data.EventData;
import io.opentelemetry.sdk.trace.data.LinkData;
import io.opentelemetry.sdk.trace.data.StatusData;
import io.opentelemetry.sdk.common.InstrumentationLibraryInfo;
import io.opentelemetry.sdk.common.InstrumentationScopeInfo;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.sdk.common.CompletableResultCode;
import java.util.Collection;
import java.util.Set;
import io.opentelemetry.api.common.AttributesBuilder;

// OBS-who. Filters spans at the export boundary, after agent instrumentation adds attributes.
public final class AllowListExtension implements AutoConfigurationCustomizerProvider {
    private static final Set<String> ALLOWED = Set.of(
            "http.request.method", "http.route", "http.response.status_code", "http.server.duration",
            "db.system.name", "db.system", "db.statement", "db.query.text",
            "vera.user.id", "vera.act", "vera.job.kind", "vera.job.outcome",
            "vera.plugin.instance", "vera.plugin.outcome");

    @Override
    public void customize(AutoConfigurationCustomizer customizer) {
        customizer.addSpanExporterCustomizer((exporter, config) -> new FilteringSpanExporter(exporter));
    }

    static SpanData filterSpanData(SpanData span) {
        return new FilteringSpanData(span);
    }

    private static final class FilteringSpanExporter implements SpanExporter {
        private final SpanExporter delegate;

        private FilteringSpanExporter(SpanExporter delegate) {
            this.delegate = delegate;
        }

        @Override
        public CompletableResultCode export(Collection<SpanData> spans) {
            return delegate.export(spans.stream().<SpanData>map(AllowListExtension::filterSpanData).toList());
        }
        @Override
        public CompletableResultCode flush() {
            return delegate.flush();
        }

        @Override
        public CompletableResultCode shutdown() {
            return delegate.shutdown();
        }
    }

    private static final class FilteringSpanData implements SpanData {
        private final SpanData delegate;
        private final Attributes attributes;

        private FilteringSpanData(SpanData delegate) {
            this.delegate = delegate;
            var attributes = Attributes.builder();
            delegate.getAttributes().forEach((key, value) -> {
                String name = key.getKey();
                if (ALLOWED.contains(name) || (name.endsWith("Id") && value instanceof String)) {
                    put(attributes, key, value);
                }
            });
            this.attributes = attributes.build();
        }

        @SuppressWarnings("unchecked")
        private static <T> void put(AttributesBuilder builder, AttributeKey<T> key, Object value) {
            builder.put(key, (T) value);
        }

        @Override public String getName() { return delegate.getName(); }
        @Override public SpanKind getKind() { return delegate.getKind(); }
        @Override public SpanContext getSpanContext() { return delegate.getSpanContext(); }
        @Override public SpanContext getParentSpanContext() { return delegate.getParentSpanContext(); }
        @Override public StatusData getStatus() { return delegate.getStatus(); }
        @Override public long getStartEpochNanos() { return delegate.getStartEpochNanos(); }
        @Override public Attributes getAttributes() { return attributes; }
        @Override public java.util.List<EventData> getEvents() { return delegate.getEvents(); }
        @Override public java.util.List<LinkData> getLinks() { return delegate.getLinks(); }
        @Override public long getEndEpochNanos() { return delegate.getEndEpochNanos(); }
        @Override public boolean hasEnded() { return delegate.hasEnded(); }
        @Override public int getTotalRecordedEvents() { return delegate.getTotalRecordedEvents(); }
        @Override public int getTotalRecordedLinks() { return delegate.getTotalRecordedLinks(); }
        @Override public int getTotalAttributeCount() { return attributes.size(); }
        @Override
        @SuppressWarnings("deprecation")
        public InstrumentationLibraryInfo getInstrumentationLibraryInfo() {
            return delegate.getInstrumentationLibraryInfo();
        }
        @Override public InstrumentationScopeInfo getInstrumentationScopeInfo() {
            return delegate.getInstrumentationScopeInfo();
        }
        @Override public Resource getResource() { return delegate.getResource(); }
    }
}
