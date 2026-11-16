MAKEFLAGS += --no-print-directory

# ─── Frontend dev server ───
FRONTEND_PID := .frontend.pid
FRONTEND_LOG := .frontend.log

# ─── The Java testing backend, which the frontend's live mode proxies /api to ───
BACKEND_PORT ?= 8081
BACKEND_DB_PORT ?= 5433
SEED ?= base
SEED_NUMBER ?= 1
SCALE ?= 1
# VERA_TEST_WORKERS  frontend test workers (default 4)
# live: the dev servers talk to the backend, started for them; mock: to the in-browser mock.
API_MODE ?= live
api-env = VITE_API_MODE=$(API_MODE) VITE_API_PROXY_TARGET=http://127.0.0.1:$(BACKEND_PORT)
backend-for-api = $(if $(filter live,$(API_MODE)),backend-bg)

# ─── One frontend per fake user ───
# Each fake user gets its own port, by its place in this list: admin on 5201, curator on 5202…
MOCK_USERS := admin curator digitization staff reader no-access project-user
ROLES ?= $(MOCK_USERS)
ROLES_DIR := .dev-roles
ROLES_BASE_PORT := 5200
OPEN := $(shell command -v xdg-open 2>/dev/null || echo open)

.DEFAULT_GOAL := help
.PHONY: help up backend backend-bg backend-stop backend-build backend-test backend-db backend-db-stop backend-replay plugins replay record frontend-env frontend-install frontend-users frontend-user frontend-fault dev-frontend dev-frontend-bg dev-frontend-stop dev-roles dev-roles-stop dev-roles-status dev-roles-open build-frontend format format-check lint ui-check typecheck check test version-check set-version open-client docs docs-check openapi openapi-check seed-schema seed-schema-check plugin-schema plugin-schema-check obs-cluster obs-up obs-status obs-down obs-cluster-delete seed-volume

help: ## Show available tasks
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: dev-frontend ## Start the frontend

frontend-env: ## Create frontend/.env.local from the example when missing
	@test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
	@echo "Frontend environment ready at frontend/.env.local"

frontend-install: ## Install the dependencies of the frontend and the shared packages with Bun
	bun install

frontend-users: ## List available emulated users for the frontend
	@printf '%s\n' 'Available fake users: admin, curator, digitization, staff, reader, no-access, project-user'

frontend-user: ## Set the frontend fake user (make frontend-user MOCK_USER=reader)
	@test -n "$(MOCK_USER)" || { echo "Usage: make frontend-user MOCK_USER=reader"; exit 1; }
	@case "$(MOCK_USER)" in admin|curator|digitization|staff|reader|no-access|project-user) ;; *) echo "Unknown fake user: $(MOCK_USER). Run 'make frontend-users'."; exit 1 ;; esac
	cd frontend && bun -e 'const user = Bun.argv[1]; const file = Bun.file(".env.local"); let text = await file.exists() ? await file.text() : await Bun.file(".env.example").text(); if (/^VITE_MOCK_USER=/m.test(text)) text = text.replace(/^VITE_MOCK_USER=.*$$/m, "VITE_MOCK_USER=" + user); else text = text.trimEnd() + "\nVITE_MOCK_USER=" + user + "\n"; await Bun.write(".env.local", text); console.log("Frontend fake user set to " + user + ". Restart the dev server to apply it.");' "$(MOCK_USER)"

frontend-fault: ## Make the mock fail on purpose (make frontend-fault MOCK_FAULT=data; none ends it)
	@case "$(MOCK_FAULT)" in none|unavailable|data|slow) ;; *) echo "Usage: make frontend-fault MOCK_FAULT=none|unavailable|data|slow"; exit 1 ;; esac
	cd frontend && bun -e 'const fault = Bun.argv[1]; const file = Bun.file(".env.local"); let text = await file.exists() ? await file.text() : await Bun.file(".env.example").text(); if (/^VITE_MOCK_FAULT=/m.test(text)) text = text.replace(/^VITE_MOCK_FAULT=.*$$/m, "VITE_MOCK_FAULT=" + fault); else text = text.trimEnd() + "\nVITE_MOCK_FAULT=" + fault + "\n"; await Bun.write(".env.local", text); console.log("Mock fault set to " + fault + ". Restart the dev server to apply it.");' "$(MOCK_FAULT)"

backend-db: ## Start the local PostgreSQL 18 backend database (BACKEND_DB_PORT=5433)
	@if docker container inspect vera-backend-db >/dev/null 2>&1; then docker start vera-backend-db; else \
		docker run -d --name vera-backend-db -e POSTGRES_DB=vera -e POSTGRES_USER=vera -e POSTGRES_PASSWORD=vera \
		-p $(BACKEND_DB_PORT):5432 -v vera-backend-db:/var/lib/postgresql postgres:18; fi

backend-db-stop: ## Stop the local backend database container
	docker stop vera-backend-db

backend: backend-db ## Run the backend in the foreground (BACKEND_PORT=8081)
	cd backend && VERA_PORT=$(BACKEND_PORT) VERA_SEEDS_DIR=$(CURDIR)/seeds VERA_CONTRACT_DIR=$(CURDIR)/contract ./gradlew :testing:bootRun

backend-pid = $$(head -n 1 .backend.pid)
backend-is-running = test -f .backend.pid && \
	test "$$(ps -o lstart= -p $(backend-pid) 2>/dev/null)" = "$$(tail -n 1 .backend.pid)"

backend-bg: ## Run the backend in the background (pid in .backend.pid, logs in .backend.log)
	@if $(backend-is-running); then echo "Backend already running (pid $(backend-pid)) on http://127.0.0.1:$(BACKEND_PORT)"; exit 0; fi; \
	rm -f .backend.pid; \
	( cd backend && VERA_PORT=$(BACKEND_PORT) VERA_SEEDS_DIR=$(CURDIR)/seeds VERA_CONTRACT_DIR=$(CURDIR)/contract setsid sh -c \
		'{ echo $$$$; ps -o lstart= -p $$$$; } > ../.backend.pid.tmp && mv ../.backend.pid.tmp ../.backend.pid && exec ./gradlew :testing:bootRun' \
	) > .backend.log 2>&1 < /dev/null & \
	while ! test -f .backend.pid; do sleep 0.1; done; \
	tries=0; while ! grep -q "Started VeraTestingApplication" .backend.log && $(backend-is-running) && [ $$tries -lt 300 ]; do \
		sleep 0.1; tries=$$((tries + 1)); done; \
	if grep -q "Started VeraTestingApplication" .backend.log; then echo "Backend on http://127.0.0.1:$(BACKEND_PORT) (pid $(backend-pid))"; \
	else echo "Backend did not start, see .backend.log"; exit 1; fi

backend-stop: ## Stop the background backend
	@if ! test -f .backend.pid; then echo "Backend is not running (no .backend.pid)"; exit 0; fi; \
	if $(backend-is-running); then kill -- -"$(backend-pid)" && echo "Backend stopped (pid $(backend-pid))"; \
	else echo "Backend was not running: pid $(backend-pid) is gone or now belongs to another process"; fi; \
	rm -f .backend.pid

backend-reset: ## Reset the running backend to a seed (SEED=base)
	@curl -fsS -X POST -H 'Content-Type: application/json' -d '{"seed":"$(SEED)"}' http://127.0.0.1:$(BACKEND_PORT)/_engine/reset; echo

plugins: ## Build and sign the shipped plugin packages
	cd backend && ./gradlew :plugins:packages

backend-build: ## Build the backend
	cd backend && ./gradlew build

backend-test: ## Run the backend tests
	cd backend && ./gradlew test

replay: ## Replay recordings against VERA_API_URL or the background backend
	@if [ -n "$(VERA_API_URL)" ]; then \
		cd replay && VERA_API_URL="$(VERA_API_URL)" bun test; \
	else \
		$(MAKE) backend-db || exit $$?; \
		(cd backend && ./gradlew :testing:pluginPackages) || exit $$?; \
		started=0; \
		if ! $(backend-is-running); then $(MAKE) backend-bg || exit $$?; started=1; fi; \
		trap 'if [ "$$started" = 1 ]; then $(MAKE) -C $(CURDIR) backend-stop; fi' EXIT; \
		cd $(CURDIR)/replay && VERA_REPLAY_PACKAGES=$(CURDIR)/backend/testing/build/plugin-packages VERA_API_URL=http://127.0.0.1:$(BACKEND_PORT) bun test; \
	fi

backend-replay: replay ## Alias for replay

record: ## Record mock API call lists through the frontend's MSW handlers
	cd frontend && TZ=Europe/Prague VITE_API_BASE_URL=http://recording.test/api bun recordings/record.ts

dev-frontend: frontend-env $(backend-for-api) ## Run the frontend dev server (API_MODE=live against the backend, or mock)
	cd frontend && $(api-env) bun run dev

# The server runs in its own session and records its own pid, which is also its process group,
# so stopping it signals bun and the vite child it spawns together. The pid file also holds the
# process start time: a pid the system has since reused for something else has a different one,
# so a stale file is never trusted.
frontend-pid = $$(head -n 1 $(FRONTEND_PID))
frontend-is-running = test -f $(FRONTEND_PID) && \
	test "$$(ps -o lstart= -p $(frontend-pid) 2>/dev/null)" = "$$(tail -n 1 $(FRONTEND_PID))"

dev-frontend-bg: frontend-env $(backend-for-api) ## Run the frontend dev server in the background (API_MODE=live against the backend, or mock; pid in .frontend.pid)
	@if $(frontend-is-running); then \
		echo "Frontend already running (pid $(frontend-pid))"; exit 0; \
	fi; \
	rm -f $(FRONTEND_PID); \
	cd frontend && $(api-env) setsid sh -c '{ echo $$$$; ps -o lstart= -p $$$$; } > ../$(FRONTEND_PID).tmp && \
		mv ../$(FRONTEND_PID).tmp ../$(FRONTEND_PID) && exec bun run dev' \
		> ../$(FRONTEND_LOG) 2>&1 < /dev/null & \
	while ! test -f $(FRONTEND_PID); do sleep 0.1; done; \
	echo "Frontend started (pid $(frontend-pid)), logs in $(FRONTEND_LOG)"

dev-frontend-stop: ## Stop the background frontend dev server
	@if ! test -f $(FRONTEND_PID); then echo "Frontend is not running (no $(FRONTEND_PID))"; exit 0; fi; \
	if $(frontend-is-running); then \
		kill -- -"$(frontend-pid)" && echo "Frontend stopped (pid $(frontend-pid))"; \
	else \
		echo "Frontend was not running: pid $(frontend-pid) is gone or now belongs to another process"; \
	fi; \
	rm -f $(FRONTEND_PID)

# Shell helpers for the per-user servers, the same pid-and-start-time scheme as above:
# `port_of <user>` prints the user's port; `host_of <user>` prints the loopback address the user's
# server listens on. Each has its own, so each browser window keeps its own session cookie (cookies
# are per host, not per port). `is_running <pidfile>` checks the pid file is live.
roles-shell = \
	port_of() { i=1; for user in $(MOCK_USERS); do \
		if [ "$$user" = "$$1" ]; then echo $$(($(ROLES_BASE_PORT) + i)); return; fi; \
		i=$$((i + 1)); done; }; \
	host_of() { i=1; for user in $(MOCK_USERS); do \
		if [ "$$user" = "$$1" ]; then echo "127.0.0.$$i"; return; fi; \
		i=$$((i + 1)); done; }; \
	is_running() { test -f "$$1" && \
		test "$$(ps -o lstart= -p "$$(head -n 1 "$$1")" 2>/dev/null)" = "$$(tail -n 1 "$$1")"; }

dev-roles: frontend-env $(backend-for-api) ## Run a background dev server per fake user against the backend (ROLES="admin reader" for some)
	@$(roles-shell); mkdir -p $(ROLES_DIR); \
	for role in $(ROLES); do \
		port=$$(port_of "$$role"); \
		host=$$(host_of "$$role"); \
		if [ -z "$$port" ]; then echo "Unknown fake user: $$role. Run 'make frontend-users'."; exit 1; fi; \
		pidfile=$(ROLES_DIR)/$$role.pid; log=$(ROLES_DIR)/$$role.log; \
		if is_running "$$pidfile"; then echo "$$role already running on http://$$host:$$port/"; continue; fi; \
		rm -f "$$pidfile"; \
		( cd frontend && VITE_MOCK_USER="$$role" $(api-env) setsid sh -c \
			'{ echo $$$$; ps -o lstart= -p $$$$; } > "$$0.tmp" && mv "$$0.tmp" "$$0" && exec bun run dev --host "$$2" --port "$$1" --strictPort' \
			"../$$pidfile" "$$port" "$$host" > "../$$log" 2>&1 < /dev/null & ); \
		while ! test -f "$$pidfile"; do sleep 0.1; done; \
		tries=0; while ! grep -q "Local:" "$$log" && is_running "$$pidfile" && [ $$tries -lt 100 ]; do \
			sleep 0.1; tries=$$((tries + 1)); done; \
		if grep -q "Local:" "$$log"; then echo "$$role on http://$$host:$$port/"; \
		else echo "$$role did not start, see $$log"; fi; \
	done

dev-roles-stop: ## Stop the per-user dev servers (ROLES="admin reader" for some)
	@$(roles-shell); \
	for role in $(ROLES); do \
		pidfile=$(ROLES_DIR)/$$role.pid; \
		test -f "$$pidfile" || continue; \
		if is_running "$$pidfile"; then kill -- -"$$(head -n 1 "$$pidfile")" && echo "$$role stopped"; \
		else echo "$$role was not running"; fi; \
		rm -f "$$pidfile"; \
	done

dev-roles-status: ## Show which per-user dev servers run, and where
	@$(roles-shell); \
	for role in $(MOCK_USERS); do \
		if is_running "$(ROLES_DIR)/$$role.pid"; then echo "  $$role	http://$$(host_of "$$role"):$$(port_of "$$role")/"; \
		else echo "  $$role	stopped"; fi; \
	done

dev-roles-open: ## Open every running per-user dev server in the browser
	@$(roles-shell); opened=0; \
	for role in $(ROLES); do \
		if is_running "$(ROLES_DIR)/$$role.pid"; then \
			$(OPEN) "http://$$(host_of "$$role"):$$(port_of "$$role")/" > /dev/null 2>&1 & opened=1; fi; \
	done; \
	if [ $$opened -eq 0 ]; then echo "No per-user dev server is running. Start them with 'make dev-roles'."; fi

build-frontend: ## Build the frontend for production
	cd frontend && bun run build

format: ## Format frontend source files
	cd frontend && bun run format

format-check: ## Check frontend formatting
	cd frontend && bun run format:check

lint: ## Lint frontend source files
	cd frontend && bun run lint

ui-check: ## Check the frontend against the UI gates (frontend/ui-gates.md)
	cd frontend && bun run check:ui

typecheck: ## Type-check the frontend and the shared packages
	cd frontend && bun run typecheck
	cd contract && bun run typecheck
	cd domain && bun run typecheck
	cd seeds/tools && bun run typecheck
	cd replay && bun run typecheck

# check and test do not build the backend; they will once the backend builds in CI.
check: format-check lint ui-check typecheck version-check docs-check openapi-check seed-schema-check plugin-schema-check event-catalogue-check ## Run the project checks

docs: ## Rewrite the generated blocks in the reference from the code
	cd frontend && bun ../docs/tools/docs.ts

docs-check: ## Check the reference: generated blocks, rule IDs, links
	cd frontend && bun ../docs/tools/docs.ts --check

openapi: ## Write contract/openapi.json from the endpoint table
	cd contract && bun tools/openapi.ts

openapi-check: ## Check contract/openapi.json against the endpoint table
	cd contract && bun tools/openapi.ts --check

seed-schema: ## Write JSON Schemas for the complete and patch seed formats
	cd contract && bun tools/seed-schema.ts

seed-schema-check: ## Check the committed seed JSON Schemas
	cd contract && bun tools/seed-schema.ts --check

plugin-schema: ## Write the plugin descriptor JSON Schema
	cd contract && bun tools/plugin-schema.ts

plugin-schema-check: ## Check the committed plugin descriptor JSON Schema
	cd contract && bun tools/plugin-schema.ts --check

test: ## Run the frontend tests and the shared packages' tests
	cd frontend && bun run test
	cd contract && bun test
	cd domain && bun test
	cd seeds/tools && bun test
	cd replay && bun test refusal-coverage.test.ts src/coverage.test.ts src/endpoints.test.ts src/instants.test.ts src/recording.test.ts src/selection.test.ts

version-check: ## Ensure package version matches VERSION
	@test "$$(node -p "require('./frontend/package.json').version")" = "$$(cat VERSION)" || { echo "frontend/package.json and VERSION differ"; exit 1; }

set-version: ## Set VERSION and frontend package version (VERSION=x.y.z)
	@test -n "$(VERSION)" || { echo "Usage: make set-version VERSION=x.y.z"; exit 1; }
	@printf '%s\n' "$(VERSION)" > VERSION
	cd frontend && bun -e 'const p = await Bun.file("package.json").json(); p.version = "$(VERSION)"; await Bun.write("package.json", JSON.stringify(p, null, 2) + "\n")'

seed-volume: ## Generate the production-sized seed (SEED_NUMBER=1 SCALE=1)
	bun seeds/tools/seed-volume.ts --seed $(SEED_NUMBER) --scale $(SCALE)

open-client: dev-frontend ## Start the client

# The observability stack (DEC-0017) in a local k3d cluster of its own: HyperDX on
# http://localhost:8300, OpenTelemetry on localhost:4317 (gRPC) and :4318 (HTTP).
K3D_CLUSTER ?= vera
OBS_CONTEXT = k3d-$(K3D_CLUSTER)

obs-cluster: ## Create the local k3d cluster for the observability stack, if it is missing
	@k3d cluster list $(K3D_CLUSTER) >/dev/null 2>&1 || k3d cluster create $(K3D_CLUSTER) \
		-p "8300:8300@loadbalancer" -p "4317:4317@loadbalancer" -p "4318:4318@loadbalancer" --wait
	@k3d cluster start $(K3D_CLUSTER) >/dev/null 2>&1 || true

obs-up: obs-cluster ## Install or upgrade the local observability stack (HyperDX on http://localhost:8300)
	helm dependency build deploy/helm/vera
	helm upgrade --install vera deploy/helm/vera -f deploy/helm/vera/values-local.yaml \
		--namespace vera --create-namespace --kube-context $(OBS_CONTEXT) --wait --timeout 15m

obs-status: ## Show the local observability stack's pods and services
	kubectl --context $(OBS_CONTEXT) -n vera get pods,svc

obs-down: ## Uninstall the local observability stack; the cluster and its volumes stay
	helm uninstall vera --namespace vera --kube-context $(OBS_CONTEXT)

obs-cluster-delete: ## Delete the local k3d cluster, with everything it recorded
	k3d cluster delete $(K3D_CLUSTER)

event-catalogue: ## Write the shared event catalogue
	cd contract && bun tools/event-catalogue.ts

event-catalogue-check: ## Check the shared event catalogue
	cd contract && bun tools/event-catalogue.ts --check
