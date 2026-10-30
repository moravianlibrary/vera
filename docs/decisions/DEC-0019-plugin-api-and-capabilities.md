# DEC-0019: The plugin API is written once, and a version declares what it can do

> **Proposal.** Drafted on 2026-10-30; not settled.

**Context.** VERA's plugins are described by what they supply
([PLG-declares](../reference/integrations/plugins.md#plg-declares)), but nowhere by what VERA
calls on them, with what, and how a call fails. The backend's `plugin-api` module is to be one
interface per kind ([B6](../develop/backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)),
and the engine's fakes have to behave as the real plugins will
([backend.md](../develop/backend.md#what-the-engine-has-to-do-first), step 5). Some ways in
already depend on what a plugin can do: Catalog search needs a catalog adapter that searches,
and detecting a pasted line's type needs an Input plugin that detects types
([ACT-ways-in](../reference/access/acts.md#act-ways-in)). Today the mock decides the first from
an instance setting (`search: off`) and the second from the version's `inputMode`; neither is
something the plugin promises.

**Decision.**
- **One description of the plugin contract**, per kind: its operations, what each takes and
  answers, and its refusals ([PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds)),
  as a reference page and as zod types in `domain/src/plugin-api/`. The engine's fakes implement
  the types; the Java `plugin-api` is written from them by hand, as the OpenAPI document is
  written from the endpoint table (B2): no generator.
- **Three outcomes** for every call, as B6 names them: answered, unavailable, refused, a refusal
  with a code from the kind's closed list
  ([PLG-api-outcome](../reference/integrations/plugin-api.md#plg-api-outcome)).
- **Capabilities are declared.** A kind's optional operations are listed in the version's
  declarations as `operations`, read from `vera-plugin.json` at upload without running code, and
  checked against the interfaces the class implements when it loads. An instance may switch a
  declared operation off, never on
  ([PLG-api-capabilities](../reference/integrations/plugin-api.md#plg-api-capabilities)).
- **A JSON Schema for `vera-plugin.json`**, from `declarationsSchema`, as the seed gets one
  (step 4), so a plugin author outside MZK can check a package before signing it.

**Rejected.**
- *Asking the plugin at run time* what it supports: upload and Plugins would have to load and
  run code to show a version, which B6 rules out.
- *Capabilities as instance configuration only* (today's `search: off`): the configuration can
  claim what the code cannot do.
- *Generating the Java interfaces from the TypeScript types*: the backend plan already rejects
  code generation for the HTTP contract (B2); the same review that keeps that table honest keeps
  this one.
