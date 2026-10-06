# Plugins

The plugin contract: what every plugin is, what VERA gives it, what it gives
back, and the interface of each kind. Drafted 2026-10-01 for review. The
backend is Java (Spring), so the interfaces are Java. Everything marked
**Proposed** answers one of the `TODO(Plugins)` notes in the other documents
and waits for confirmation; §6 lists them.

How plugins appear on the page is [[view-catalog]] *Plugins*; when they run is
*Schedules*; who may touch them is [[permissions]] (`plugin.*`).

---

## 1. Type, implementation, instance

| Level | What it is | Example |
|---|---|---|
| **kind** | the job, and the interface for it (§4) | *Registry* |
| **implementation** | code that implements one kind: a jar, a version, a declared contract (§2.1) | `KrameriusRegistry 1.8.0` |
| **instance** | a configured copy of an implementation that runs | *MZK Kramerius*, `base_url=kramerius.mzk.cz` |

One implementation, many instances: MZK, NKP and VKOL Aleph are three
instances of one catalog adapter, which is also the shape a multi-library VERA
needs. An instance belongs to exactly one implementation **version**; upgrading
is §2.6.

### 1.1 The kinds

| Kind | Given | Returns | Runs |
|---|---|---|---|
| **Catalog adapter** | an identifier, or a catalog ID and unit | the catalog record, its units, its properties | on proposal, on ingest, on schedule (record sync), on demand (search) |
| **Registry** | a document | what that registry says about it | on proposal, on ingest, on schedule |
| **Harvester** | its own configuration | documents to propose, as its agent | on schedule, on demand |
| **Property source** | a document and its record | values for properties it declares | on ingest, on record change, on schedule |
| **Validation** | an iteration and its record | defects | on ingest, on record change, on schedule |
| **Restriction** | a request or an iteration and its record | a prohibition, or none | on proposal, on ingest, on record change, on schedule — **new kind, Proposed** |
| **Custody** | a proposal as JSON | proposal-custody names | on proposal, when checks finish, on change ([[proposal-custody]]) |
| **Input** | a pasted text, a camera frame, a photo | identifiers, or candidate records | on demand, in the Propose dialog |
| **List generator** | pages, shape, pool, current members | a draft with a reason per pick | on demand, in the list editor |
| **Identity** | a login | who logged in, and their claims | on login ([[identity]]) |
| **Message** | recipients, subject, context | a redirect, or *sent* | on demand ([[messaging]]) |
| **Delivery channel** | a batch of events and a destination | delivered, or failed | on event, from a hook |

**Restriction is new.** Only rules forbid ([[status-model]] §2), and the
demo's *Forbidden by Copyright* had no plugin behind it. A kind of its own,
rather than a validation that sometimes forbids, so that an admin can see on
one row of Plugins every piece of code that is able to say *never*: a
restriction takes an admin to lift, a defect only a curator.

**Kramerius is two plugins.** A *Registry* answers *is it published?*; a
*Harvester* proposes what it finds (decided 2026-09-26). The demo still
carries the agent on the registry; that is a data fix.

---

## 2. What every plugin shares

### 2.1 The descriptor

Every implementation ships a descriptor, read at upload, before any of its
code runs. It is what the implementation row on Plugins shows as its
**contract**.

```java
public record PluginDescriptor(
    String id,                      // "cz.mzk.vera.kramerius-registry" — stable across versions
    String name,                    // "KrameriusRegistry"
    String version,                 // semver of the implementation
    Kind kind,                      // one of §1.1
    String contractVersion,         // the version of this contract it was built against, "1.0"
    JsonSchema configSchema,        // what an instance is configured with (§2.2)
    Set<Trigger> triggers,          // which of §2.4 it accepts
    Declarations declares,          // the names it promises to keep stable (§2.5)
    Egress egress                   // what leaves VERA, and to where (§5)
) {}
```

`Declarations` holds whatever the kind lets it name, each a closed list:

| Kind | Declares |
|---|---|
| Catalog adapter | identifier types it resolves · properties it supplies |
| Registry | raw states it can report · link kinds |
| Property source | properties it supplies, with their definitions ([[document-properties]] §2) |
| Validation | rule codes, each with a label and the subjects it reports on |
| Restriction | rule codes, each with a label |
| Input | identifier types it recognises |
| List generator | its class: rule-based or AI-based |

A result naming something it did not declare is rejected (§3).

### 2.2 Configuration

An instance's configuration is a JSON object, checked against `configSchema`
before saving. Two things are never in it:

- **Secrets.** A field marked `"secret": true` in the schema is stored apart,
  shown as `•••`, and handed to the plugin only through `Context.secret(name)`.
- **What VERA decides.** Tiers, the order of instances, an agent's name, the
  entry point, a registry's mapping are VERA settings on the instance (§2.7,
  §4), shown beside the configuration and edited the same way, but owned by
  VERA, so no implementation can set them for itself.

### 2.3 VERA calls, VERA writes

**A plugin never writes to VERA's database.** It is called with what it needs
and returns a result; VERA checks the result (§3), writes it, and logs it. The
machine noticing is not the machine deciding, so the plugin returns
**facts** — a record, a state, a defect, a name — and every consequence
(*existing copy*, *Needed*, *Forbidden*, which custody) is VERA's rule applied to
them.

The plugin gets one object for the call:

```java
public interface Context {
    JsonNode config();                       // the instance configuration
    String secret(String name);              // a secret field, §2.2
    HttpClient http();                       // the only way out — limited to the declared egress, §5
    Clock clock();
    Logger log();                            // lands in the task's log on Tasks
    Progress progress();                     // items done, of how many — what Tasks draws
    boolean cancelled();                     // the task was cancelled; stop at the next item
}
```

No repository, no other plugin, no file system. A plugin that needs data VERA
has is given it in the call; if a kind needs more, the interface grows, which
is a contract version.

### 2.4 Triggers

| Trigger | When | Kinds |
|---|---|---|
| `ON_PROPOSAL` | a request is created | catalog adapter, registry, restriction, custody |
| `ON_INGEST` | an approved request is ingested, at `Enqueued` | catalog adapter, registry, property source, validation, restriction |
| `ON_RECORD_CHANGE` | a record sync finds the catalog record changed | property source, validation, restriction, custody |
| `ON_SCHEDULE` | a schedule on Schedules | catalog adapter, registry, harvester, property source, validation, restriction |
| `ON_DEMAND` | a person: *Run now*, Propose, Generate, *Message…* | harvester, input, list generator, message, any schedulable kind |
| `ON_LOGIN` | a login | identity |
| `ON_EVENT` | a hook fires | delivery channel |

Every run that is not inside a request (a schedule, *Run now*, ingest of a
batch) is a **task** on Tasks, with the instance, the trigger and its log.
Ingest is `ON_INGEST`, started by an approval, never by hand.

### 2.5 Stable names

The validation axis rests on recognising *the same defect* across runs
([[status-model]] §2), and approvals are stored against
`defect_key = (plugin_instance_id, rule_code, subject)`. So the contract makes
names a promise:

- **A declared name is never reused for something else.** A rule code, a
  property key, a raw state keeps its meaning for the life of the
  implementation `id`, across versions.
- **A version may add names and retire names, never rename.** Retiring one is
  stated in the descriptor (`retired: ["R05"]`).
- **`subject` is the locus, precise enough to tell two findings apart**: a
  MARC field and subfield (`245$a`), a page, a linked record. Never the value.

Because the key holds the **instance**, not the implementation, two instances
of one validation (say, a strict and a lenient ruleset) are two sets of
defects, and approving one never approves the other.

### 2.6 Versions and upgrades

- **Several versions can be installed**; each instance runs exactly one.
  Upgrading an instance is an act on Plugins, not a side effect of uploading.
- **Before an instance moves, Plugins shows the difference** in what it
  declares: names added, names retired, config fields added or dropped. A
  retired rule code says what follows: *accepted defects under R05 are no
  longer reported, so their approvals have nothing to cover*.
- **`contractVersion`**: VERA runs any implementation built against the same
  major contract version. An implementation for another major version is
  installable but cannot be enabled.

### 2.7 Agents — Proposed

A plugin that proposes ([[view-map]] §6) needs a requester, and an agent is a
user record of kind *agent*. **Proposed:**

- **One agent per instance**, created with it, named in the instance's
  *agent name* setting. Two harvester instances are two agents, so a curator
  can tell their proposals apart and a custody rule can route them apart.
- **An agent never logs in** and holds no role; what it may do is the
  instance's kind and entry point, nothing else.
- **Deleting the instance keeps the agent**, marked *retired*, with every
  request it made. Its history stays attributable, and the name stays taken.
- Only harvesters propose. A catalog adapter, a registry or a validation
  finding something never creates a request.

### 2.8 Tiers and order — Proposed

**Tiers are per installation, set on the instance.** The descriptor may
suggest one; the admin decides, on Plugins. Answers [[document-properties]]
§4: a plugin cannot outrank the catalog by claiming it.

- `manual` is the reserved top tier; no instance can be set to it or above.
- Two instances at the same tier for the same property cannot be saved.

**Order is per kind, set on the instance**, wherever several instances can
answer the same question: which catalog adapter resolves an ISSN first, which
Identity instance comes first on the login page, which Message instance the
dialog preselects. Answers [[identifier-types]]: the type → plugin mapping is
what each adapter declares it resolves, and order picks among them.

---

## 3. What VERA checks on every result

A result that breaks one of these is **rejected whole**, logged on the task,
and counted on the instance's row; nothing is trimmed into shape.

| Rule | Kinds |
|---|---|
| it names only what the descriptor declares (§2.5) | all that declare |
| its values have the declared type ([[document-properties]] §2) | catalog adapter, property source |
| an unknown registry state is `Unmapped`, never a guess — VERA maps, the plugin reports raw | registry |
| a generator draws only from the pool, never splits a document, never draws from 0%, gives a reason for every pick ([[intentions]] §4.2) | list generator |
| a custody name that is not a custody is ignored and warned about ([[proposal-custody]] §3) | custody |
| a redirect is `https:`, `mailto:` or a declared deep-link scheme | message |
| it answered within the instance's timeout | all |

**Three ways to not answer**, the same three [[registry-status]] §2 draws:

```java
sealed interface Outcome<T> {
    record Answer<T>(T value) implements Outcome<T> {}          // what it found — empty is an answer
    record Unavailable<T>(String why, Duration retryAfter)      // down, timeout, auth: try again
        implements Outcome<T> {}
    record Refused<T>(String why) implements Outcome<T> {}      // this input cannot be answered, ever
}
```

`Unavailable` keeps the previous answer standing, with its old `observed_at`
(*published, as of 6 weeks ago, unreachable since*). `Refused` is a fact about
the input: for a catalog adapter it is *no catalog record*, a defect repaired in
the catalog.

Kinds that run over many items take them in **batches** and return one
`Outcome` per item, so one bad record never fails the other 199.

---

## 4. The kinds

Each kind is one interface. Signatures are trimmed to what the contract
decides; the records they use are VERA's, versioned with the contract.

### 4.1 Catalog adapter

```java
public interface CatalogAdapter extends Plugin {
    Outcome<CatalogRef> resolve(Identifier id, Context ctx);           // ISSN 1801-1234 → MZK01-000211870
    Outcome<CatalogRecord> fetch(CatalogRef ref, Context ctx);         // the record, as the catalog has it
    Outcome<List<Unit>> units(CatalogRef ref, Context ctx);            // volumes and issues — document-identity
    default Outcome<List<SearchHit>> search(String text, Context ctx) { // only if it declares search
        return new Outcome.Refused<>("not searchable");
    }
    default Optional<CatalogRef> fromLink(URI recordPage) { return Optional.empty(); } // a pasted OPAC link
    default Optional<URI> toLink(CatalogRef ref) { return Optional.empty(); } // the record's page, to repair it
}

public record Unit(String unitId, UnitType type, String label,
                   Map<String, PropertyValue> properties) {}           // page count, issuance — arrive tiered, §2.8
public record CatalogRecord(CatalogRef ref, JsonNode fields, Instant changedAt,
                            Map<String, PropertyValue> properties) {}
```

- **Answers [[document-identity]]:** a unit is a stable `unitId`, a type and a
  label, and may carry properties (page count, issuance). Those are ordinary
  property values at the instance's tier.
- `changedAt` is how a record sync knows the record changed, which re-runs
  validation, restriction and custody (`ON_RECORD_CHANGE`).
- A catalog that cannot be searched from VERA declares no search and gives
  the OPAC address and `fromLink`: the Propose dialog opens it in a new tab and
  reads the pasted link back.
- `toLink` is where a curator repairs a record: VERA corrects no catalog data,
  so the Validations pane links out and a Recheck reads the record again
  (decided 2026-10-06). An adapter that gives no link leaves the curator to
  find the record themselves.

### 4.2 Registry

```java
public interface Registry extends Plugin {
    List<Outcome<Observation>> lookup(List<DocumentRef> docs, Context ctx);
}
public record Observation(String rawState,          // verbatim — "Revision"
                          Optional<String> externalId,
                          Optional<URI> url, LinkKind linkKind) {}   // content | record
```

- **It reports raw states only.** The `raw_state → state` mapping and *which
  states count as an existing copy* are **VERA settings on the instance**,
  seeded from the descriptor's declared raw states, edited on Plugins
  ([[registry-status]] §3.2, §9). An undeclared or unmapped raw state is
  `Unmapped`. This is a change from the TODO there: the mapping is not
  plugin-owned, because a plugin that maps can guess, and an admin can fix a
  mapping without a new version.
- **A registry can never produce a restriction**: there is nothing in
  `Observation` to carry one.

### 4.3 Harvester

```java
public interface Harvester extends Plugin {
    Stream<Discovery> harvest(Since since, Context ctx);      // since the last run, or a configured date
}
public record Discovery(Identifier id, Optional<String> unitId, Optional<String> reason) {}
```

- VERA turns each discovery into a **request by the instance's agent**
  (§2.7), with its **entry point** (`proposals` or `additions`) as a VERA
  setting on the instance ([[view-map]] §6). A discovery already in VERA
  attaches to that work, as anybody's ask would.
- One run is one **batch**, named after the instance and the run.

### 4.4 Property source

```java
public interface PropertySource extends Plugin {
    List<Outcome<Map<String, PropertyValue>>> values(List<Subject> docs, Context ctx);
}
```

- Only declared properties; an absent key is *no answer* and the next tier
  answers ([[document-properties]] §4). A changed value writes a status-log
  entry, by VERA.

### 4.5 Validation

```java
public interface Validation extends Plugin {
    List<Outcome<List<Finding>>> check(List<Subject> its, Context ctx);
}
public record Finding(String ruleCode, String subject,       // the defect_key, with the instance, §2.5
                      String publicText, String internalText) {}
```

- **The whole current set, every run.** VERA rewrites `iteration_defects`
  from it and compares with the verdicts ([[status-model]] §2), so an empty
  list is *nothing wrong*, and a finding missing from this run is gone.
- `publicText` is what an asker reads; it is about the document, never a
  motive ([[view-rules]] §4.3).
- Severity (*blocking*, *advisory*) is a VERA setting on the instance: an
  advisory finding is shown and never holds the gate. **Proposed**, because the
  demo already configures it.

### 4.6 Restriction — new, Proposed

```java
public interface Restriction extends Plugin {
    List<Outcome<Optional<Prohibition>>> evaluate(List<Subject> subjects, Context ctx);
}
public record Prohibition(String ruleCode, String publicText, String internalText) {}
```

- Evaluated on whatever exists: a request before ingest, the iteration after
  ([[status-model]] §2). `Optional.empty()` where there was one **clears it**,
  logged.
- Only an admin lifts it (`restriction.overrule`), and the override is
  VERA's, beside the plugin's verdict.

### 4.7 Custody

```java
public interface Custody extends Plugin {
    Outcome<List<String>> custodies(JsonNode proposal, Context ctx);   // ["Periodicals", "Moravica"], or []
}
```

The JSON, the jq reference implementation, the union and the fallback are
[[proposal-custody]] §3–§4.

### 4.8 Input

```java
public interface Input extends Plugin {
    InputMode mode();                                          // TEXT | CAMERA | PHOTO
    Outcome<List<Detected>> read(InputPayload payload, Context ctx);
}
public record Detected(Optional<Identifier> id,             // what it recognised, typed
                       Optional<RecordQuery> text,          // or the text: title, author, year, shelf mark
                       double confidence) {}
```

- Three modes, one per way into Propose: **TEXT** detects types in a pasted
  list, **CAMERA** reads barcodes continuously, **PHOTO** reads a cover or a
  card. A mode with no enabled instance has no way in, absent.
- A `RecordQuery` is matched against the catalog **by VERA**, through the
  catalog adapters, and comes back as candidates for a person to pick. An
  Input never adds an item by itself.

### 4.9 List generator

```java
public interface ListGenerator extends Plugin {
    GeneratorClass generatorClass();                          // RULE_BASED | AI_BASED
    Outcome<Draft> generate(GenerationRequest req, Context ctx);
}
public record GenerationRequest(int pages, Set<CategoryRef> categories,
                                IntentionMix shapeBy,               // scope and percentages, one intention
                                Optional<Map<CategoryRef, Integer>> allocation,
                                List<PoolItem> pool,                // only what passes the gates, not listed
                                List<PoolItem> currentMembers, double tolerance) {}
public record Draft(List<Pick> picks, List<Shortfall> shortfall) {}
public record Pick(String iterationId, String reason) {}
```

- Given the pool, not a query: a generator cannot reach what it may not list.
- The [[intentions]] §4.2 rules are checked by VERA on the `Draft` (§3).
- **An AI generator declares its egress** (§5): which pool fields are sent,
  and where. Plugins shows it on the instance.

### 4.10 Identity

```java
public interface Identity extends Plugin {
    LoginEntry entry();                                       // REDIRECT (a button) | FORM (local accounts)
    Outcome<AuthenticatedUser> authenticate(LoginCallback cb, Context ctx);
}
public record AuthenticatedUser(String externalId,          // the declared user id claim, identity §1
                                Optional<String> verifiedEmail, String displayName,
                                Map<String, List<String>> claims) {}
```

The label, order, default role, attribute mapping and *match by email* are VERA
settings on the instance ([[identity]] §1), applied by VERA to `claims`.

### 4.11 Message

```java
public interface Message extends Plugin {
    Outcome<MessageResult> open(MessageRequest req, Context ctx);
    Optional<String> address(UserProfile u);                  // how it reaches a person, or not at all
}
sealed interface MessageResult {
    record Redirect(URI to) implements MessageResult {}       // mailto:, a Slack deep link
    record Sent(String where) implements MessageResult {}     // posted by the plugin
}
```

`address` is what the dialog uses to list *not reachable by …*
([[messaging]] §3).

### 4.12 Delivery channel

```java
public interface DeliveryChannel extends Plugin {
    ChannelInterface iface();                                 // EMAIL | CHAT | WEBHOOK | FILE
    Outcome<Delivered> deliver(Delivery d, Context ctx);
}
public record Delivery(String hookId, String destination, List<EventPayload> events,
                       Grouping grouping) {}                  // one per recipient, or one message
```

Retries, *wait for more* and dead letters are the hook's, by VERA
([[view-catalog]] *Hooks*); the channel only sends once and says whether it
did.

---

## 5. What leaves VERA

Every implementation declares its **egress**: the hosts it talks to, and for
kinds that send VERA's data out, **which fields**.

| Kind | Sends out |
|---|---|
| catalog adapter, registry, harvester | identifiers and catalog IDs, to the declared hosts |
| list generator, AI-based | the pool fields it declares — title, category, priority, pages, ask date — to its model |
| message, delivery channel | the public texts and links ([[view-rules]] §4.3); internal texts never |
| identity | nothing of VERA's |

`Context.http()` refuses any other host. The declaration is shown on the
instance on Plugins, because it is metadata leaving the library.

---

## 6. Answered here, to confirm

| TODO in | Proposed answer | § |
|---|---|---|
| [[status-model]] §2 *defect key* | `(instance, rule_code, subject)`; rule codes are declared, never renamed, only retired; an upgrade shows what a retirement does to approvals | 2.5, 2.6 |
| [[document-properties]] §4 *who assigns tiers* | the admin, per instance; the descriptor only suggests | 2.8 |
| [[document-identity]] *what a unit is* | `unitId`, type, label, optional properties at the instance's tier | 4.1 |
| [[identifier-types]] *which plugin resolves which type* | each catalog adapter declares the types it resolves; order picks among instances | 2.8, 4.1 |
| [[registry-status]] §3.2, §9 *mapping and existing copy* | VERA settings on the registry instance, seeded from the declared raw states — **not** plugin-owned | 4.2 |
| [[view-map]] §6 *agent identity* | one agent per proposing instance; kept, retired, when the instance is deleted | 2.7 |
| — *who forbids* | a new kind, **Restriction** | 1.1, 4.6 |
| — *validation severity* | blocking or advisory, a VERA setting on the instance | 4.5 |

## 7. Open

- **Isolation.** A classloader per implementation version is the minimum. Does
  VERA also need plugins in a separate process, for code an admin uploads but
  did not write? It decides whether `plugin.upload_code` is safe to grant at all.
- **RDCZ `Revision`** ([[registry-status]] §5) stays a question for RDCZ, not
  for the contract: it is `Unmapped` until somebody maps it.

## Related

- [[view-catalog]]: Plugins, Schedules, Hooks
- [[status-model]]: defects, restrictions, the gates
- [[registry-status]]: observations and existing copies
- [[document-properties]]: tiers
- [[proposal-custody]], [[identity]], [[messaging]], [[intentions]] §4: the kinds with their own pages
- [[permissions]]: `plugin.read`, `.configure`, `.upload_code`, `.run`
