# VERA

Digitisation planning for the Moravian Library. VERA is the system the digitisation department
plans its work in: it builds and tracks digitisation intentions and worklists, synchronises
bibliographic records from the library catalogue and the national union catalogue (SKC), and flags
metadata discrepancies before a document goes to scanning.

## VERA 1.0.0

This branch holds the current system. Its successor, VERA 1.0.0, is a rewrite (a Java backend,
a React client, plugins for catalogs, registries and logins) and is released on **1 December
2026**. The work on it is on the
[`release/1.0.0`](https://github.com/moravianlibrary/vera/tree/release/1.0.0) branch.
The current system stays on the [`legacy`](https://github.com/moravianlibrary/vera/tree/legacy)
branch.

## Stack

| Part | Built with |
|---|---|
| `server/` | FastAPI, SQLAlchemy, Alembic migrations, Celery workers, Elasticsearch-backed search |
| `webclient/` | React |
| Auth | Keycloak / OIDC |
| Deployment | Containerised, built through GitLab CI |

The server splits into `routers/`, `services/`, `models/`, `schemas/` and `tasks/`, with scheduled
background work driven by `vera_scheduler.py` and Celery (`worker.py`).

## Running locally

```bash
make create-env      # python3.12 venv in server/, installs requirements_server.txt
make run-devel       # rebuild and start the server and worker via docker-compose
```

`docker-compose.yml.template` shows the services expected in a local environment.

## Notes

This repository is published as a record of the work. It is built around the Moravian Library's
catalogue, authentication and digitisation infrastructure, so it is not intended to run standalone
outside that environment — the AI page-count prediction module it calls is maintained separately
and is not included here.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
