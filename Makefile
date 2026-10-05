MAKEFLAGS += --no-print-directory

# ─── Frontend dev server ───
FRONTEND_PID := .frontend.pid
FRONTEND_LOG := .frontend.log

.DEFAULT_GOAL := help
.PHONY: help up frontend-env frontend-install frontend-users frontend-user dev-frontend dev-frontend-bg dev-frontend-stop build-frontend format format-check lint typecheck check test version-check set-version open-client

help: ## Show available tasks
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: dev-frontend ## Start the frontend

frontend-env: ## Create frontend/.env.local from the example when missing
	@test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
	@echo "Frontend environment ready at frontend/.env.local"

frontend-install: ## Install frontend dependencies with Bun
	cd frontend && bun install

frontend-users: ## List available emulated users for the frontend
	@printf '%s\n' 'Available fake users: admin, curator, digitization, staff, reader, no-access'

frontend-user: ## Set the frontend fake user (make frontend-user MOCK_USER=reader)
	@test -n "$(MOCK_USER)" || { echo "Usage: make frontend-user MOCK_USER=reader"; exit 1; }
	@case "$(MOCK_USER)" in admin|curator|digitization|staff|reader|no-access) ;; *) echo "Unknown fake user: $(MOCK_USER). Run 'make frontend-users'."; exit 1 ;; esac
	cd frontend && bun -e 'const user = Bun.argv[1]; const file = Bun.file(".env.local"); let text = await file.exists() ? await file.text() : await Bun.file(".env.example").text(); if (/^VITE_MOCK_USER=/m.test(text)) text = text.replace(/^VITE_MOCK_USER=.*$$/m, "VITE_MOCK_USER=" + user); else text = text.trimEnd() + "\nVITE_MOCK_USER=" + user + "\n"; await Bun.write(".env.local", text); console.log("Frontend fake user set to " + user + ". Restart the dev server to apply it.");' "$(MOCK_USER)"

dev-frontend: frontend-env ## Run the frontend development server
	cd frontend && bun run dev

# The server runs in its own session and records its own pid, which is also its process group,
# so stopping it signals bun and the vite child it spawns together. The pid file also holds the
# process start time: a pid the system has since reused for something else has a different one,
# so a stale file is never trusted.
frontend-pid = $$(head -n 1 $(FRONTEND_PID))
frontend-is-running = test -f $(FRONTEND_PID) && \
	test "$$(ps -o lstart= -p $(frontend-pid) 2>/dev/null)" = "$$(tail -n 1 $(FRONTEND_PID))"

dev-frontend-bg: frontend-env ## Run the frontend dev server in the background (pid in .frontend.pid)
	@if $(frontend-is-running); then \
		echo "Frontend already running (pid $(frontend-pid))"; exit 0; \
	fi; \
	rm -f $(FRONTEND_PID); \
	cd frontend && setsid sh -c '{ echo $$$$; ps -o lstart= -p $$$$; } > ../$(FRONTEND_PID).tmp && \
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

build-frontend: ## Build the frontend for production
	cd frontend && bun run build

format: ## Format frontend source files
	cd frontend && bun run format

format-check: ## Check frontend formatting
	cd frontend && bun run format:check

lint: ## Lint frontend source files
	cd frontend && bun run lint

typecheck: ## Type-check frontend source files
	cd frontend && bun run typecheck

check: format-check lint typecheck version-check ## Run the project checks

test: ## Run frontend tests
	cd frontend && bun run test

version-check: ## Ensure package version matches VERSION
	@test "$$(node -p "require('./frontend/package.json').version")" = "$$(cat VERSION)" || { echo "frontend/package.json and VERSION differ"; exit 1; }

set-version: ## Set VERSION and frontend package version (VERSION=x.y.z)
	@test -n "$(VERSION)" || { echo "Usage: make set-version VERSION=x.y.z"; exit 1; }
	@printf '%s\n' "$(VERSION)" > VERSION
	cd frontend && bun -e 'const p = await Bun.file("package.json").json(); p.version = "$(VERSION)"; await Bun.write("package.json", JSON.stringify(p, null, 2) + "\n")'

open-client: dev-frontend ## Start the client
