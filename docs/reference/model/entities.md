# Entities

What each thing in VERA is, who it is for, and the facts it holds. How they connect is in
[relationships](relationships.md); what states they pass through is in the
[lifecycles](../lifecycles/).

> VERA decides **what gets digitized next**, and keeps track of why.

## Work

#### ENT-document

A **document** is one physical thing that can be scanned: a book, one volume of a periodical, a
bundle. It is named by its catalog record and, when it is one part of a larger record, by the
unit ([DOC-identity](documents.md#doc-identity)). It is the only concept a reader needs.

It holds what is true of the thing whatever happens to it:
- title and type (Periodical, Monograph, Manuscript, Map);
- shelf mark;
- page counts from each source ([DOC-page-count](documents.md#doc-page-count));
- what each registry says about it ([REG-evidence](../integrations/registries.md#reg-evidence)).

#### ENT-iteration

An **iteration** is one attempt to digitize a document. A book scanned in 2019 and again in 2029
is one document and two iterations. Everything that can differ between attempts belongs to the
iteration:
- its category, a leaf;
- its priority;
- the project that funds it;
- the list it is on;
- its restriction, defects, verdicts and cancellation;
- its progress, and its scan and publication.

The last attempt is the document's **current** one. Every view that seems to list documents
lists their current iterations.

#### ENT-request

A **request** is one person (or agent) asking for one document. It carries the asker's reason,
the batch it came in, and optionally a project. *Proposal* and *addition* are not other
entities: a proposal is a request nobody has decided yet, and an addition is an approved one
whose ingest has not finished. Several people may ask for the same document; one request
produces its iteration and the others follow it ([LC-REQ-one-iteration](../lifecycles/request.md#lc-req-one-iteration)).

#### ENT-batch

A **batch** is one submission of several requests at once: a file, a pasted list, barcode
scans, or a harvest. It is what an administrator retries and what a decider can approve
together. Every submission is a batch, one item included; a batch is shown as one only when it
holds two items or more.

> **Open — [L20](../../ledger.md#l20-every-submission-is-a-batch).** The code makes a batch only
> for two items or more.

#### ENT-list

A **digitization list** is a set of iterations a scanning operation works through, with a start
and an end, an optional page target, and, if it was generated, what it was generated with. It
is current state, not history: what was once on a list is in the log, not on the list
([LC-LIST-delete](../lifecycles/list.md#lc-list-delete)).

## Planning

#### ENT-category

A **category** is a line of digitization work: a stream the library plans and staffs on its own
(*Periodicals*, *Monographs → 19th century*). It classifies the attempt, not the book. A node
earns its place when all three hold:
- someone is responsible for it;
- the library would set a share for it;
- a decider can place an item in it at approval without research.

Anything else (subject, language, period) is a filter on catalog data, not a category.

#### ENT-mix

A **mix** is a named, reusable definition of the proportions the library wants across the
category tree. Each set of siblings splits its parent's share. A mix has revisions, which are
never changed once saved; a revision may carry a label. One active mix is **Primary**, the one
offered by default. A mix holds no scope, size or dates, and has no output of its own
([PLAN-mix](../planning/mixes.md#plan-mix)).

#### ENT-intention

An **intention** is a scope and an objective.

| Part | What it holds |
|---|---|
| Scope | which funding (any, none, or one project) and which part of the tree |
| Objective | a window from a start to an optional end, an optional page target, and an optional mix |

An item counts towards every intention whose scope it matches, so intentions overlap and their
figures are never added. Only an intention has a target, pace or a mix
([PLAN-intention](../planning/intentions.md#plan-intention)).

There are three kinds:
- **Overall**: exactly one, made at installation, counting everything;
- **a project's own intention**: made with the project, its funding and window read from the
  project;
- **any other**: made by hand, or by a repeat.

#### ENT-repeat

A **repeat** makes one intention per period (week, month or quarter) from a template: a name
pattern, scope, target and mix.

#### ENT-project

A **project** is money and people: a funded, time-boxed envelope with a manager and members who
may propose into it. It is Proposed, Approved or Rejected; approving it sets the priority its
items get. It has no target, pace or mix of its own. Those belong to its own intention
([LC-PROJ-own-intention](../lifecycles/project.md#lc-proj-own-intention)).

## People and access

#### ENT-access

Users, roles, groups, identities and proposal custodies are defined in [people](../access/people.md)
and [custody](../access/custody.md).

## The machinery

#### ENT-plugin

A **plugin** is code that VERA runs for one job (catalog adapter, registry, harvester, custody
rule, delivery channel…). It comes as an **implementation** with versions; an **instance** is
one configured use of it ([PLG-model](../integrations/plugins.md#plg-model)).

#### ENT-run

A **run** is one execution of a plugin or a job, started by a person, a schedule or an event,
and listed on Tasks with its progress, result and errors.

#### ENT-schedule

A **schedule** runs a plugin instance on a cadence.

#### ENT-hook

A **hook** sends a message through a delivery channel when an event happens
([HOOK-model](../integrations/hooks.md#hook-model)).

#### ENT-watchlist

A **watchlist** is a saved filter over one page, kept by a person or shared with others
([WATCH-model](../integrations/watchlists.md#watch-model)).

#### ENT-log-entry

A **log entry** records one cause of a change: who, when, what, and why
([LOG-cause](log.md#log-cause)).
