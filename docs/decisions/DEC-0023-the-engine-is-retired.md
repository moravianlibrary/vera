# DEC-0023: The engine is retired; the Java testing backend is the development server

> **Decided** on 2026-11-16. Replaces the part of
> [DEC-0022](DEC-0022-the-engine-stops-at-asking-and-deciding.md) that kept the engine.

**Context.** DEC-0022 kept the TypeScript engine as the development server for access, asking
and deciding, and left steps 4 to 8 to the backend. The Java backend now serves every endpoint
of the table, passes every recording but the one only the mock can play (154 pass, 1 skip), and
its `testing` module serves the control routes (`/_engine/reset`, `clock`, `outbox`, `jobs/run`,
`sessions`, `identity`, `endpoints`), loads the same seeds and installs the fakes as plugins. The
engine serves a third of that, so keeping it means two servers to keep equal for no area only it
covers.

**Decision.**
- **The engine is deleted**: `engine/`, its make targets and its tests.
- **The seeds** move to a top-level `seeds/` folder (`base`, `installation`, `minimal`, and the
  volume generator in `seeds/tools/`), read by the contract's schema, the frontend's tests, the
  docs tool and the Java seed loader.
- **The dev servers** in live mode (the default) start the Java testing backend on port 8081 and
  proxy to it; `API_MODE=mock` keeps the in-browser mock.
- **`make replay`** starts the backend and replays the recordings against it, or against
  `VERA_API_URL` when set.
- **What stays:** the `/_engine` route names, the MSW mock (recordings are made through it, and
  mock mode uses it), the recordings as the backend's yardstick, and the engine's settled
  decisions E1 to E21 where the backend follows them ([engine.md](../develop/engine.md)).
- **Rule IDs cited in the Java sources** are checked by `make docs-check`.

**Rejected.**
- *Keeping the engine for the areas it serves*: a second implementation of access, asking and
  deciding to keep equal to the backend, which already passes the same recordings.
- *Seeds in the backend's resources*: the contract, the frontend's tests and the docs tool read
  them too.
