#!/bin/sh
set -eu

export VERA_ROLE="${VERA_ROLE:-all}"
set --
if [ -n "${VERA_OTEL_ENDPOINT:-}" ]; then
    export OTEL_EXPORTER_OTLP_ENDPOINT="$VERA_OTEL_ENDPOINT"
    set -- \
        "-javaagent:/app/otel/opentelemetry-javaagent.jar" \
        "-Dotel.javaagent.extensions=/app/otel/vera-otel-extension.jar" \
        "-Dotel.service.name=vera-backend" \
        "-Dotel.resource.attributes=vera.role=${VERA_ROLE}" \
        "-Dotel.instrumentation.http.server.capture-request-headers=" \
        "-Dotel.instrumentation.http.server.capture-response-headers=" \
        "-Dotel.instrumentation.jdbc.statement-sanitizer.enabled=true" \
        "-Dotel.instrumentation.common.db-statement-sanitizer.enabled=true" \
        "-Dotel.instrumentation.logback-appender.enabled=true"
fi

exec java "$@" -jar /app/vera.jar
