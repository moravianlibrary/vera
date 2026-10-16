# Glossary

Every domain term in English and Czech, with a one-line meaning and where it is defined. The UI
ships in both languages, with Czech primary in production. Message keys and translations follow
these terms (in `develop/i18n.md`, part 5).

> **Open — [L37](ledger.md#l37-czech-terms).** The Czech column is a first draft for you to
> correct. Several terms, such as *iteration* and *mix*, need a word the library already uses.

## Work

| English | Czech (draft) | Meaning | Defined in |
|---|---|---|---|
| document | dokument | one physical thing that can be scanned | [ENT-document](reference/model/entities.md#ent-document) |
| unit | jednotka (svazek, ročník) | one part of a larger catalog record | [DOC-identity](reference/model/documents.md#doc-identity) |
| NBN | ČNB | the national bibliography number, an identifier type | [DOC-identifiers](reference/model/documents.md#doc-identifiers) |
| iteration, attempt | pokus o digitalizaci | one attempt to digitize a document | [ENT-iteration](reference/model/entities.md#ent-iteration) |
| request, ask | žádost | one person asking for one document | [ENT-request](reference/model/entities.md#ent-request) |
| proposal | návrh | a request nobody has decided yet | [ENT-request](reference/model/entities.md#ent-request) |
| addition | přírůstek | an approved request whose ingest has not finished | [ENT-request](reference/model/entities.md#ent-request) |
| batch | dávka | several requests submitted at once | [ENT-batch](reference/model/entities.md#ent-batch) |
| rescan | nové skenování | a new attempt over an existing copy | [LC-ITER-rescan](reference/lifecycles/iteration.md#lc-iter-rescan) |
| existing copy | existující kopie | a scan that already exists somewhere | [DOC-existing-copy](reference/model/documents.md#doc-existing-copy) |
| digitization list | digitalizační seznam | iterations a scanning operation works through | [ENT-list](reference/model/entities.md#ent-list) |
| pool | zásobník | what a list can take | [LC-LIST-pool](reference/lifecycles/list.md#lc-list-pool) |
| ingest | příjem | reading the record and running the checks after approval | [LC-ITER-ingest](reference/lifecycles/iteration.md#lc-iter-ingest) |
| page count | počet stran | pages, from the highest-tier source | [DOC-page-count](reference/model/documents.md#doc-page-count) |
| property | vlastnost | an admin-defined fact about a document or one attempt | [DOC-property](reference/model/documents.md#doc-property) |
| source | zdroj | who gave a property's value: a person or a plugin instance | [DOC-property-values](reference/model/documents.md#doc-property-values) |
| tier | úroveň | a source's rank; the highest with a value is in use | [DOC-property-values](reference/model/documents.md#doc-property-values) |
| public, staff property | veřejná, interní vlastnost | read by everyone who reads the record, or in staff detail only | [DOC-property-visibility](reference/model/documents.md#doc-property-visibility) |

## Status

| English | Czech (draft) | Meaning | Defined in |
|---|---|---|---|
| decision | rozhodnutí | Pending, Approved, Denied, Withdrawn, Duplicate | [STAT-axes](reference/model/status.md#stat-axes) |
| restriction | omezení | a rule's finding that forbids digitizing | [STAT-axes](reference/model/status.md#stat-axes) |
| overrule | zrušit omezení | an administrator lifting a restriction | [ACT-overrule](reference/access/acts.md#iterations) |
| defect | vada | a finding that makes metadata not good enough | [STAT-defect-key](reference/model/status.md#stat-defect-key) |
| validation | validace | whether the defects are ruled on | [STAT-validation](reference/model/status.md#stat-validation) |
| verdict | verdikt | accepting, denying or revoking defects | [STAT-validation](reference/model/status.md#stat-validation) |
| progress | průběh | Enqueued … Published | [STAT-axes](reference/model/status.md#stat-axes) |
| gate | brána | a condition an item must pass to be listed | [STAT-gates](reference/model/status.md#stat-gates) |
| cancel, hold | pozastavit | stopping work, with a reason | [LC-ITER-cancel](reference/lifecycles/iteration.md#lc-iter-cancel) |
| not digitizable | nelze digitalizovat | a hold set from a running list | [LC-ITER-not-digitizable](reference/lifecycles/iteration.md#lc-iter-not-digitizable) |
| registry state | stav v registru | what another registry says about a document | [REG-states](reference/integrations/registries.md#reg-states) |

## Planning

| English | Czech (draft) | Meaning | Defined in |
|---|---|---|---|
| category | kategorie | a line of digitization work | [ENT-category](reference/model/entities.md#ent-category) |
| refine | zjemnit | give a leaf with documents its first child | [PLAN-refine](reference/planning/categories.md#plan-refine) |
| mix | rozložení | proportions wanted across the tree | [ENT-mix](reference/model/entities.md#ent-mix) |
| share | podíl | one category's percentage in a mix | [PLAN-mix-sets](reference/planning/mixes.md#plan-mix-sets) |
| Primary mix | hlavní rozložení | the mix offered by default | [PLAN-mix-primary](reference/planning/mixes.md#plan-mix-primary) |
| intention | záměr | a scope and an objective | [ENT-intention](reference/model/entities.md#ent-intention) |
| intention's scope | rozsah záměru | its funding, its category and any conditions on properties | [PLAN-scope](reference/planning/intentions.md#plan-scope) |
| Overall | celkový záměr | the intention that counts everything | [PLAN-overall](reference/planning/intentions.md#plan-overall) |
| repeat | opakování | makes one intention per period | [ENT-repeat](reference/model/entities.md#ent-repeat) |
| planned, delivered, output | naplánováno, dodáno, výstup | what an intention counts | [PLAN-counting](reference/planning/intentions.md#plan-counting) |
| on pace, behind pace | v tempu, za tempem | a target's progress | [PLAN-target](reference/planning/intentions.md#plan-target) |
| project | projekt | a funded envelope with members | [ENT-project](reference/model/entities.md#ent-project) |
| priority | priorita | Low, Normal, High, Urgent | [ENT-iteration](reference/model/entities.md#ent-iteration) |

## Access

| English | Czech (draft) | Meaning | Defined in |
|---|---|---|---|
| permission | oprávnění | one thing a person may do | [PERM-grant](reference/access/permissions.md#perm-grant) |
| scope | rozsah | which records a grant reaches | [scopes](reference/access/scopes.md) |
| grant | udělení | a permission at a scope | [PERM-grant](reference/access/permissions.md#perm-grant) |
| role | role | a bundle of grants | [ROLE-bundle](reference/access/roles.md#role-bundle) |
| group | skupina | people who share responsibility | [ACCESS-group](reference/access/people.md#access-group) |
| category custody | správa kategorie | who looks after a line of work | [ACCESS-category-custody](reference/access/custody.md#access-category-custody) |
| request custody | správa žádostí | who decides a set of proposals | [ACCESS-request-custody](reference/access/custody.md#access-request-custody) |
| fallback | záchytná správa | the custody for what no rule placed | [ACCESS-fallback](reference/access/custody.md#access-fallback) |
| agent | agent | a plugin that proposes like a person | [ACCESS-user-kinds](reference/access/people.md#access-user-kinds) |
| identity | identita | one way a person logs in | [ACCESS-identity-key](reference/access/people.md#access-identity-key) |

## Machinery

| English | Czech (draft) | Meaning | Defined in |
|---|---|---|---|
| plugin, implementation, instance | zásuvný modul, implementace, instance | the code and its configured uses | [PLG-model](reference/integrations/plugins.md#plg-model) |
| run | běh | one execution, listed on Tasks | [ENT-run](reference/model/entities.md#ent-run) |
| schedule | plán spouštění | runs an instance on a cadence | [ENT-schedule](reference/model/entities.md#ent-schedule) |
| hook | háček (hook) | sends a message when an event happens | [HOOK-model](reference/integrations/hooks.md#hook-model) |
| delivery channel | doručovací kanál | where a hook sends | [HOOK-model](reference/integrations/hooks.md#hook-model) |
| watchlist | sledovaný seznam | a saved filter over one page | [WATCH-model](reference/integrations/watchlists.md#watch-model) |
| status log | historie | the append-only record of causes | [LOG-cause](reference/model/log.md#log-cause) |
