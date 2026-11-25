# VERA

VERA decides **what the Moravian Library digitizes next**, and keeps track of why. Readers, staff
and projects propose documents from the library catalog. Curators decide on the proposals. Planners
shape the work by category and turn it into lists for the scanners. VERA then follows each document
until it is published in Kramerius. It reads the catalog, checks records and registries such as
Kramerius and SKC, and flags what stands in the way before a document goes to scanning.

This is VERA 1.0.0, a rewrite of the system on [`main`](https://github.com/moravianlibrary/vera/tree/main).
It is released on **1 December 2026**.

## Stack

| Part | Built with |
|---|---|
| `backend/` | Java 25, Spring Boot 4, jOOQ, Liquibase, PostgreSQL 18; one image runs as the API or the worker |
| `backend/plugins/` | the shipped plugins: catalog adapters (Aleph over OAI-PMH, with a searchable mirror), registries (Kramerius), logins (local accounts, OpenID Connect), MARC validation, mail and more, each a signed package on a versioned plugin API |
| `frontend/` | React 19, Vite, TanStack Query; an in-browser mock (MSW) for working without the backend |
| `contract/`, `domain/` | the API contract in zod, shared by the client and the mock; the OpenAPI and seed schemas are generated from it |
| `replay/`, `journeys/` | recorded API calls replayed against the backend, and Playwright user journeys |
| `deploy/helm/vera/` | a Helm chart: CloudNativePG, the API, the worker, the frontend, optional ClickStack observability |

## Running locally

You need Docker, Bun and a JDK 25. For the cluster you also need `k3d`, `kubectl` and `helm`.

```sh
make frontend-install        # dependencies of the frontend and the shared packages
make backend-db              # PostgreSQL 18 in Docker, on port 5433
make backend-bg              # the backend with test data, on port 8081
make backend-reset           # load the base seed (SEED=base)
make dev-frontend            # http://localhost:5173 against the backend
```

`make dev-frontend API_MODE=mock` runs the client against its in-browser mock instead, with no
backend. `make deploy-local` installs VERA the way production runs it into a local k3d cluster,
on http://localhost:8400, with a local Keycloak and Mailpit. `make help` lists every task.
`make check`, `make test` and `make backend-test` run the checks and tests.

VERA is built around the Moravian Library's catalog, logins and digitization infrastructure. The
plugins are how another library would connect its own.

## Documentation

[`docs/`](docs/README.md) says what VERA does, for whom, and why:
- the [reference](docs/reference/README.md) states every rule once, under a stable ID that the code
  cites;
- the [decisions](docs/decisions/README.md) explain the larger choices;
- the [user journeys](docs/user-journeys/README.md) walk through each role;
- the [ledger](docs/ledger.md) tracks what is built.

## Licence

VERA — digitization planning for the Moravian Library\
Copyright (C) 2026 Moravská zemská knihovna v Brně

Written by Robert Randiak.

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version. It is distributed in the hope that it will be
useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
