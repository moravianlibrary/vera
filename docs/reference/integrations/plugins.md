# Plugins

Everything VERA asks of the outside world, and every rule that can change, is a plugin. The acts
are in [acts](../access/acts.md#plugins).

#### PLG-model

A plugin has three levels:
- a **kind**, the job it does;
- an **implementation**, the code, which comes in versions;
- an **instance**, one configured use of a version, with its configuration, its secrets, its
  triggers and VERA's own settings for it.

Several instances of one implementation may run side by side (one catalog adapter per catalog).

#### PLG-kinds

| Kind | Its job |
|---|---|
| Identity | a way to log in |
| Input | a way of entering items in the propose dialog |
| Identifier | one identifier type: recognises, checks and normalises a value, and names the type |
| Harvester | finds new documents and proposes them, as its agent |
| Catalog adapter | reads catalog records: page counts, material type, units |
| Property source | supplies a value the catalog lacks |
| Registry | says whether a copy already exists somewhere |
| Validation | checks a record is complete enough to digitize, and finds defects |
| Restriction | forbids digitizing (copyright, embargo); only an administrator overrules it |
| Custody | places proposals in request custodies |
| Classifier | suggests the category a proposal is approved into |
| List generator | drafts a digitization list for an intention |
| Link | turns a PID or a viewer's address pasted into *Set link…* into the canonical link |
| Publication detector | finds where a digitized item was published and sets its link, as its agent |
| Message | where a message act hands a conversation to |
| Delivery channel | where a hook sends: email, chat, webhook, file |

The kinds are listed, here and on Plugins, in the order a document meets them: login, asks
arriving, facts, copies, gates, routing, planning, publishing, then communication.

#### PLG-declares

Each version declares what it supplies: the rules it checks, the properties and their tiers, the
registry states it reports, the identifier types it resolves, its agent and where its proposals
enter, its generator class, its channel interface and whether and how it reaches a person (by
the account's email, or by a handle from an identity claim), its input mode or its login entry. It also
declares the configuration keys it needs and the triggers it accepts.

#### PLG-triggers

An instance runs on one or more triggers: on proposal, on ingest, on record change, on schedule,
on demand, on login, on event. A new instance gets every trigger its version accepts, except a
schedule.

#### PLG-contract

Each version declares the contract version it was built for. VERA runs contract 1.x; a version
for another major contract can be installed but not used.

#### PLG-secrets

Secret configuration values are never sent back to the browser. A blank secret field on save
keeps the stored value.

#### PLG-upload

Uploading plugin code reads the package first and shows what it declares: for a new version, what
it adds and retires against the version in use. Installing adds the implementation or the version.
No instance moves with it.

#### PLG-upgrade

*Move to v…* moves an instance to a newer installed version that VERA can run. It first lists
what the new version adds and retires.

*Move to v…* is on the instance's drawer, so instances move one at a time.

Each instance sets its own property tiers, which of a registry's states count as an existing
copy, and a harvester's agent: its name and where what it finds enters. The implementation's
declarations are the defaults. Moved to another version, an instance keeps its choices for what
both declare; what is new takes the new version's default, and what is retired goes.

A Custody rule places into one of the request custodies on Users & Groups, picked in the rule
editor; it never names one by free text
([ACCESS-custody-by-plugins](../access/custody.md#access-custody-by-plugins)).

#### PLG-disable

Switching an instance off first says what stops, counted by the server, by kind. A generator, a
classifier or a Message instance that is the last of its kind takes its button away (*Generate*,
the suggestion, *Message…*).

#### PLG-delete

A deleted instance is kept so its runs still name it; its schedules are removed.

#### PLG-last-identity

The last enabled Identity instance cannot be disabled or deleted
([ACCESS-last-identity](../access/people.md#access-last-identity)).

#### PLG-order

Identity, Message and Classifier instances have an order. Identity's is the login page's,
Message's is the dialog's (the first is preselected), and for classifiers the first suggestion
wins.

#### PLG-no-fixing

Validation and restriction plugins find; they never fix. A defect points to the catalog record,
which is repaired there and read again with *Recheck*.

#### PLG-delivery-hooks

A delivery channel's drawer lists the hooks that send through it to anyone with `hook.read`.
Disabling it says how many active hooks stop sending, and names them to anyone with `hook.read`.
