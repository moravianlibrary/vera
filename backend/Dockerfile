# The JARs are built on the host (make images): generating the jOOQ code starts PostgreSQL in
# Docker, which a docker build cannot reach. The context is backend/build/image.
FROM eclipse-temurin:25-jre
RUN useradd --system --create-home --uid 10001 vera
WORKDIR /app
COPY vera.jar /app/vera.jar
COPY plugins/ /app/plugins/
COPY installation.json installation-mzk.json /app/
COPY otel/ /app/otel/
COPY contract/ /app/contract/
COPY entrypoint.sh /app/entrypoint.sh
ENV VERA_CONTRACT_DIR=/app/contract
EXPOSE 8081
USER 10001
ENTRYPOINT ["/app/entrypoint.sh"]
