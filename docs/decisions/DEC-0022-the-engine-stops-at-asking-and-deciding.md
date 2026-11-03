# DEC-0022: The engine stops at asking and deciding; recordings of the mock judge the backend

> **Decided** on 2026-11-03.

**Context.** The engine was planned to serve every area before the Java backend started
([engine.md](../develop/engine.md), steps 1 to 8), as the executable spec and the yardstick the
backend is checked against. Steps 1 to 3 are built (access, asking and deciding). Building them
showed that the spec is the mock: the engine runs the mock's own query and act code, shared over
a record store, and is proved by replaying recordings of what the mock answers. Each further
step would implement an area a second time in TypeScript only to be implemented again in Java,
which can share none of it; step 3 alone took eleven sessions.

**Decision.**
- **The engine stays as built**: steps 1 to 3, the development server for those areas and the
  working model of the server's shape (the store, planned acts, events and the audit stream).
  Steps 4 to 8 are not built in the engine.
- **The mock stays** the frontend's server for every area the engine does not serve, until the
  backend serves it.
- **The backend's yardstick is the recordings.** Recordings of the mock's answers, for every dev
  person and for scenarios of acts followed by the pages they change, are made for every area
  and replayed over HTTP at a base URL, against the engine for steps 1 to 3 and against the
  backend for all of them.
- **Before the backend starts:** the endpoint table holds every endpoint and the OpenAPI document
  is made from it; the recordings run over HTTP only; the rule cases are data; the seed format
  has a JSON Schema; the fakes' behaviour and the plugin API are written down
  ([backend.md](../develop/backend.md#what-comes-first)).
- **A change of behaviour** goes to the reference and the contract first, then the mock and its
  recordings, then the backend.

**Rejected.**
- *Building engine steps 4 to 8 first*: every area twice, and the engine adds no rule the mock
  and the reference do not already hold.
- *Dropping the engine*: steps 1 to 3 work, share state between the roles' browsers, and prove
  the recordings can be replayed against a real server.
