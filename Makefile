MAKEFLAGS += --no-print-directory

# ─── Frontend dev server ───
FRONTEND_PID := .frontend.pid
FRONTEND_LOG := .frontend.log

# ─── The engine, which the frontend's live mode proxies /api to ───
ENGINE_PORT ?= 8080
ENGINE_URL := http://127.0.0.1:$(ENGINE_PORT)
ENGINE_PID := .engine.pid
ENGINE_LOG := .engine.log
SEED ?= base
# live: the dev servers talk to the engine, started for them; mock: to the in-browser mock.
API_MODE ?= live
api-env = VITE_API_MODE=$(API_MODE) VITE_API_PROXY_TARGET=$(ENGINE_URL)
engine-for-api = $(if $(filter live,$(API_MODE)),engine-bg)

# ─── One frontend per fake user ───
# Each fake user gets its own port, by its place in this list: admin on 5201, curator on 5202…
MOCK_USERS := admin curator digitization staff reader no-access project-user
ROLES ?= $(MOCK_USERS)
ROLES_DIR := .dev-roles
ROLES_BASE_PORT := 5200
OPEN := $(shell command -v xdg-open 2>/dev/null || echo open)

.DEFAULT_GOAL := help
.PHONY: help up engine engine-bg engine-stop engine-reset engine-test frontend-env frontend-install frontend-users frontend-user frontend-fault dev-frontend dev-frontend-bg dev-frontend-stop dev-roles dev-roles-stop dev-roles-status dev-roles-open build-frontend format format-check lint ui-check typecheck check test version-check set-version open-client docs docs-check

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

# The engine in the foreground; Ctrl-C stops it. Its database is engine/.data/vera.sqlite.
engine: ## Run the engine in the foreground (ENGINE_PORT=8080)
	cd engine && VERA_ENGINE_DEVELOPMENT=1 VERA_ENGINE_PORT=$(ENGINE_PORT) bun run src/main.ts

engine-pid = $$(head -n 1 $(ENGINE_PID))
engine-is-running = test -f $(ENGINE_PID) && \
	test "$$(ps -o lstart= -p $(engine-pid) 2>/dev/null)" = "$$(tail -n 1 $(ENGINE_PID))"

# The same pid-and-start-time scheme as the frontend's, below.
engine-bg: ## Run the engine in the background (pid in .engine.pid, logs in .engine.log)
	@if $(engine-is-running); then echo "Engine already running (pid $(engine-pid)) on $(ENGINE_URL)"; exit 0; fi; \
	rm -f $(ENGINE_PID); \
	cd engine && VERA_ENGINE_DEVELOPMENT=1 VERA_ENGINE_PORT=$(ENGINE_PORT) setsid sh -c \
		'{ echo $$$$; ps -o lstart= -p $$$$; } > ../$(ENGINE_PID).tmp && mv ../$(ENGINE_PID).tmp ../$(ENGINE_PID) && exec bun run src/main.ts' \
		> ../$(ENGINE_LOG) 2>&1 < /dev/null & \
	while ! test -f $(ENGINE_PID); do sleep 0.1; done; \
	tries=0; while ! grep -q "VERA engine on" $(ENGINE_LOG) && $(engine-is-running) && [ $$tries -lt 100 ]; do \
		sleep 0.1; tries=$$((tries + 1)); done; \
	if grep -q "VERA engine on" $(ENGINE_LOG); then echo "Engine on $(ENGINE_URL) (pid $(engine-pid))"; \
	else echo "Engine did not start, see $(ENGINE_LOG)"; exit 1; fi

engine-stop: ## Stop the background engine
	@if ! test -f $(ENGINE_PID); then echo "Engine is not running (no $(ENGINE_PID))"; exit 0; fi; \
	if $(engine-is-running); then kill -- -"$(engine-pid)" && echo "Engine stopped (pid $(engine-pid))"; \
	else echo "Engine was not running: pid $(engine-pid) is gone or now belongs to another process"; fi; \
	rm -f $(ENGINE_PID)

engine-reset: ## Reset the running engine to a seed (SEED=base)
	@curl -fsS -X POST -H 'Content-Type: application/json' -d '{"seed":"$(SEED)"}' $(ENGINE_URL)/_engine/reset; echo

engine-test: ## Run the engine's tests
	cd engine && bun test

dev-frontend: frontend-env $(engine-for-api) ## Run the frontend dev server (API_MODE=live against the engine, or mock)
	cd frontend && $(api-env) bun run dev

# The server runs in its own session and records its own pid, which is also its process group,
# so stopping it signals bun and the vite child it spawns together. The pid file also holds the
# process start time: a pid the system has since reused for something else has a different one,
# so a stale file is never trusted.
frontend-pid = $$(head -n 1 $(FRONTEND_PID))
frontend-is-running = test -f $(FRONTEND_PID) && \
	test "$$(ps -o lstart= -p $(frontend-pid) 2>/dev/null)" = "$$(tail -n 1 $(FRONTEND_PID))"

dev-frontend-bg: frontend-env $(engine-for-api) ## Run the frontend dev server in the background (pid in .frontend.pid)
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
# `port_of <user>` prints the user's port, `is_running <pidfile>` checks the pid file is live.
roles-shell = \
	port_of() { i=1; for user in $(MOCK_USERS); do \
		if [ "$$user" = "$$1" ]; then echo $$(($(ROLES_BASE_PORT) + i)); return; fi; \
		i=$$((i + 1)); done; }; \
	is_running() { test -f "$$1" && \
		test "$$(ps -o lstart= -p "$$(head -n 1 "$$1")" 2>/dev/null)" = "$$(tail -n 1 "$$1")"; }

dev-roles: frontend-env $(engine-for-api) ## Run a background dev server per fake user (ROLES="admin reader" for some)
	@$(roles-shell); mkdir -p $(ROLES_DIR); \
	for role in $(ROLES); do \
		port=$$(port_of "$$role"); \
		if [ -z "$$port" ]; then echo "Unknown fake user: $$role. Run 'make frontend-users'."; exit 1; fi; \
		pidfile=$(ROLES_DIR)/$$role.pid; log=$(ROLES_DIR)/$$role.log; \
		if is_running "$$pidfile"; then echo "$$role already running on http://localhost:$$port/"; continue; fi; \
		rm -f "$$pidfile"; \
		( cd frontend && VITE_MOCK_USER="$$role" $(api-env) setsid sh -c \
			'{ echo $$$$; ps -o lstart= -p $$$$; } > "$$0.tmp" && mv "$$0.tmp" "$$0" && exec bun run dev --port "$$1" --strictPort' \
			"../$$pidfile" "$$port" > "../$$log" 2>&1 < /dev/null & ); \
		while ! test -f "$$pidfile"; do sleep 0.1; done; \
		tries=0; while ! grep -q "Local:" "$$log" && is_running "$$pidfile" && [ $$tries -lt 100 ]; do \
			sleep 0.1; tries=$$((tries + 1)); done; \
		if grep -q "Local:" "$$log"; then echo "$$role on http://localhost:$$port/"; \
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
		if is_running "$(ROLES_DIR)/$$role.pid"; then echo "  $$role	http://localhost:$$(port_of "$$role")/"; \
		else echo "  $$role	stopped"; fi; \
	done

dev-roles-open: ## Open every running per-user dev server in the browser
	@$(roles-shell); opened=0; \
	for role in $(ROLES); do \
		if is_running "$(ROLES_DIR)/$$role.pid"; then \
			$(OPEN) "http://localhost:$$(port_of "$$role")/" > /dev/null 2>&1 & opened=1; fi; \
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
	cd engine && bun run typecheck

check: format-check lint ui-check typecheck version-check docs-check ## Run the project checks

docs: ## Rewrite the generated blocks in the reference from the code
	cd frontend && bun ../docs/tools/docs.ts

docs-check: ## Check the reference: generated blocks, rule IDs, links
	cd frontend && bun ../docs/tools/docs.ts --check

test: ## Run the frontend tests and the shared packages' tests
	cd frontend && bun run test
	cd contract && bun test
	cd domain && bun test
	cd engine && bun test

version-check: ## Ensure package version matches VERSION
	@test "$$(node -p "require('./frontend/package.json').version")" = "$$(cat VERSION)" || { echo "frontend/package.json and VERSION differ"; exit 1; }

set-version: ## Set VERSION and frontend package version (VERSION=x.y.z)
	@test -n "$(VERSION)" || { echo "Usage: make set-version VERSION=x.y.z"; exit 1; }
	@printf '%s\n' "$(VERSION)" > VERSION
	cd frontend && bun -e 'const p = await Bun.file("package.json").json(); p.version = "$(VERSION)"; await Bun.write("package.json", JSON.stringify(p, null, 2) + "\n")'

open-client: dev-frontend ## Start the client
