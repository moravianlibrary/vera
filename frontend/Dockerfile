FROM oven/bun:1.4.3 AS build
WORKDIR /workspace
COPY package.json bun.lock ./
COPY frontend/ frontend/
COPY contract/ contract/
COPY domain/ domain/
RUN bun install --frozen-lockfile
ARG VITE_OTEL_ENDPOINT=
ARG VITE_OTEL_KEY=
ARG VITE_DEFAULT_LOCALE=cs
ENV VITE_API_MODE=live \
    VITE_API_BASE_URL=/api \
    VITE_OTEL_ENDPOINT=${VITE_OTEL_ENDPOINT} \
    VITE_OTEL_KEY=${VITE_OTEL_KEY} \
    VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE}
WORKDIR /workspace/frontend
RUN bun run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --from=build /workspace/frontend/dist/ /usr/share/nginx/html/
COPY frontend/docker/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV VERA_API_UPSTREAM=http://vera-api:8081
EXPOSE 8080
