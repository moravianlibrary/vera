# DEC-0019: The plugin API is written once, and a version declares what it can do

> **Decided.** Drafted on 2026-10-30; the cursor, the mirror, record changes on schedules and
> dropping `inputMode` settled that day, the rest on 2026-10-31.

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
- **VERA holds every cursor** a plugin goes on from (a harvester's, a catalog's changes), stored
  with what the call answered, so a failed run reads the same again
  ([PLG-api-cursor](../reference/integrations/plugin-api.md#plg-api-cursor)).
- **A catalog's changes come on its schedules**, which an administrator sets: `sync` or `changes`,
  each changed id running that document's record-change triggers
  ([PLG-api-record-change](../reference/integrations/plugin-api.md#plg-api-record-change)).
- **A catalog adapter may keep a local mirror** in VERA, fetched whole and then kept in step by
  scheduled syncs. VERA searches the mirror itself, so Catalog search works for a catalog that
  cannot be searched, and the plugin may read its records from it
  ([PLG-api-mirror](../reference/integrations/plugin-api.md#plg-api-mirror)). The plugin still
  never writes to VERA's database: it answers pages, and VERA stores them.
- **Input's `inputMode` goes**: an Input instance's ways in are the operations it declares.
- **A catalog adapter must read a record**; taking a pasted link apart (`readLink`) is optional.
  Without it, *Record link* takes that catalog's own ids only.
- **Type detection belongs to the Identifier plugins**: a pasted line's type is the one whose
  `recognise` takes it, so no Input plugin detects types, and the mock's invented
  `IdentifierDetector` goes.
- **An entry link is read by its portal's `EntryLink` instance** (`entry`), so a portal may link
  with its own parameters; the portal does not change the mechanism
  ([PLG-api-entry](../reference/integrations/plugin-api.md#plg-api-entry)).
- **A JSON Schema for `vera-plugin.json`**, from `declarationsSchema`, as the seed gets one
  (step 4), so a plugin author outside MZK can check a package before signing it.

**Rejected.**
- *Asking the plugin at run time* what it supports: upload and Plugins would have to load and
  run code to show a version, which B6 rules out.
- *Capabilities as instance configuration only* (today's `search: off`): the configuration can
  claim what the code cannot do.
- *A store the plugin writes to directly* (a key-value table it owns): it would write outside
  the call-and-apply split (B5), so a failed run could leave half a page and a moved cursor.
- *Each catalog plugin building its own search index*: every author would solve indexing again,
  and VERA could not search by identifier the same way across catalogs.
- *A type-detecting Input plugin*: it would repeat what the Identifier instances already know,
  and detection would vanish with one plugin.
- *Generating the Java interfaces from the TypeScript types*: the backend plan already rejects
  code generation for the HTTP contract (B2); the same review that keeps that table honest keeps
  this one.
