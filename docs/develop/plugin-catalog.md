# Plugin catalog

The implementations VERA ships for production, by kind, in the order of
[PLG-kinds](../reference/integrations/plugins.md#plg-kinds). Agreed on 2026-10-29. The engine
builds a fake of each one it needs ([engine.md](engine.md)); the real ones come with the backend.

## Identity

| Implementation | Instances | Notes |
|---|---|---|
| `LocalAccounts` | Local accounts | form login; staff without a library account, and, with `signup` on, anyone who creates their own ([DEC-0016](../decisions/DEC-0016-local-sign-up.md)); `mail_channel` names the mailer for its emails |
| `OidcIdentity` | MZK Keycloak · **Google** · **Seznam** | Keycloak for staff and library readers (it can broker eduID). Google and Seznam are the public's way in ([DEC-0015](../decisions/DEC-0015-public-requests-by-entry-link.md)): default role *reader*. Verify that Seznam's login speaks OpenID Connect (discovery and an ID token with a verified email); if it is plain OAuth 2.0, `OidcIdentity` needs a profile-endpoint mode rather than a second implementation |

*Match by email* only for an instance whose email claim is verified.

### `LocalAccounts`

The form entry answers no redirect. `complete` accepts only a username and password form and
checks it through VERA's instance-scoped `localPasswords()` context; a match answers the username
as the external id and name, while a missing account or wrong password is refused as
`wrong_credentials` ([PLG-api-call](../reference/integrations/plugin-api.md#plg-api-call),
[PLG-api-outcome](../reference/integrations/plugin-api.md#plg-api-outcome)). It makes no HTTP
fallback call. VERA refuses a matched account that is suspended ([ACCESS-suspend](../reference/access/people.md#access-suspend)).

Its configuration retains the seeded keys: `signup` is `on` or `off`; `password_min` is a
positive decimal character count; and `mail_channel` is an enabled Delivery channel instance id.
VERA uses these for sign-up, password length and email delivery ([ACCESS-sign-up](../reference/access/people.md#access-sign-up));
the plugin does not perform those operations.

## Input

| Implementation | Notes |
|---|---|
| `BarcodeReader` | camera or photo barcodes; must keep up with a hardware scanner's ≈ 4 s cadence ([prod-profile.md](prod-profile.md)) |
| `CoverRecognition` | covers in stacks, several books and several stacks per photo |
| `ShelfMarkRecognition` | shelf marks on spines |
| `CatalogCardRecognition` | catalog cards |
| `EntryLink` | one instance per outside portal that links into VERA ([ACT-entry-link](../reference/access/acts.md#act-entry-link)); first instance: Tlačítko digitalizovat |

The recognition inputs return, per item recognised: the catalog record and unit when found, the
identifiers matched with their types, and the evidence, a crop of the photo per item.

### `EntryLink`

`allowed_origins` is a whitespace-separated list of origins VERA checks before offering a return
link; the plugin does not enforce it ([ACT-entry-link](../reference/access/acts.md#act-entry-link),
[PLG-api-entry](../reference/integrations/plugin-api.md#plg-api-entry)). `record_parameter` is an
optional query parameter name for a portal's catalog record id; when absent or empty, no portal
specific record parameter is read. The plugin also reads VERA's `record`, `identifier`, `type`,
`unit` and `reason` parameters; reason is limited to 500 characters. It answers the page's origin
for VERA to check. The plugin returns no refusals; VERA handles the `origin_not_allowed` check, and
an unparseable page has no origin ([PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds)).

## Identifier

`Pattern`: one instance per identifier type (MZK sysno, barcode, shelf mark, ČNB). ISBN and ISSN
need a checksum, which a pattern cannot check: a `Pattern` option for the check digit, or an
`IsbnIssn` implementation.

## Harvester

| Implementation | Finds |
|---|---|
| `DnntoFromCatalog` | MZK records that could get the DNNTO licence if digitized |
| `DnntoFromSdnnt` | documents with DNNTO in SDNNT that no library has digitized |
| `PeriodicalGaps` | missing volumes of periodicals partly digitized in Kramerius (*Kontinuita*, 2 101 documents in the old VERA) |
| `SftpFile` | new files in an SFTP directory (CSV or TXT, the propose dialog's columns); each file one batch, then moved aside |
| `GoogleSheet` | new rows of a Google Sheet, through a service account; remembers the last row read |

A harvester proposes as its agent. A file or a sheet filled by other people is the harvester's
ask, not theirs: someone who should be the requester and be told the outcome comes in through
an entry link instead.

## Catalog adapter

| Implementation | Notes |
|---|---|
| `AlephOaiCatalogAdapter` | MZK Aleph through OAI-PMH; reads records and change headers, and resolves VuFind/Aleph links. No search or mirrored catalog. |
| `XmlDumpCatalogAdapter` | a downloaded catalog dump, refreshed on schedule; the reading's date is the dump's |

## Property source

| Implementation | Notes |
|---|---|
| `MarcExtentPageCount` | page count parsed from 300 $a; the old catalog counts were off by ~22 % |
| `SiblingVolumePageCount` | periodicals: the median of the title's volumes already digitized |
| `PageCountPredictor` | fallback only, low tier: the old one was off by 187 % |
| `ShelfMarkToSize` | size from the shelf mark's prefix |
| `JqProperty` | any property by a jq expression over the record |

### `ShelfMarkToSize`

`table` is an optional comma-separated list of `prefix → size` pairs (also `->`), where the size
is a value of the `size` property. The longest matching prefix wins. `tier` is an optional decimal
integer and defaults to `50`. `values` answers the `size` property at that tier only when a prefix
matches; otherwise it answers nothing. It has no refusal codes, and no MZK prefix table is shipped
([PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds)).

## Registry

`KrameriusRegistry` (one instance per Kramerius: MZK, NDK, ČDK) · `RdczRegistry`.

## Validation

| Implementation | Notes |
|---|---|
| `MarcComparator` | a client of the separate MARC comparator application: asks its API to validate a record against SKC and ČNB and maps the answer to defects. The application keeps its own catalog data; VERA keeps none for it. Most differences in prod: 300, 260, 264, 008, 020, 250, 015 |
| `FieldsCompleteness` | required fields per issuance type; a periodical volume needs its year (235 failures in the old VERA) |

## Restriction

`ForbiddenByRecordValue`: a field or subfield value that forbids digitizing.

## Custody

`JqCustody`.

### `JqCustody`

`expr` is a required jq 1.6 filter over `{ request, document, record }`; `request.project` is the
project name, and `record` is null until record data is added to this API. An exact `true` output
places the proposal in the instance's picked request custody; other outputs place it nowhere. A
missing custody choice places nothing. An invalid expression or evaluation error fails the plugin
call and makes no placement ([ACCESS-custody-by-plugins](../reference/access/custody.md#access-custody-by-plugins),
[PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds),
[PLG-api-outcome](../reference/integrations/plugin-api.md#plg-api-outcome)).

## Classifier

`MaterialType` · `PlaceOfPublication`. Worth trying later: a classifier trained on past
approvals (17 000 labelled documents in the old VERA).

### `MaterialType`

`table` is a comma-separated list of `type → categoryId` pairs; `->` is also accepted, and type
matching ignores case. For example, `periodical→c22, map→c4`. A matching document type answers
that category with why `Document type: <type>`; an unmapped type answers no suggestion. It has no
refusal codes ([PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds)).

## List generator

`PriorityThenMix`: fills by priority first, then by the intention's mix proportions (the old
VERA's generator, there called *PriorityFirst*) · `ShelfAdvisor`.

### `PriorityThenMix`

`tolerance` is a percentage, with or without `%` (for example `5%`); invalid or zero values use
5%. `order` must be `priority,asked`; VERA supplies the pool in descending priority, then oldest
request order. A mix is filled leaf by leaf within that order; whole documents may exceed a
leaf goal by the tolerance and 50 pages of fixed slack. Unfilled shares spread to the nearest
eligible category and are reported as shortfalls when they cannot be filled. Without a mix, the
same order fills the requested page total without a category split. A correcting allocation does
not spread. These answers follow [PLAN-generate](../reference/planning/generation.md#plan-generate),
[PLAN-generate-mix](../reference/planning/generation.md#plan-generate-mix),
[PLAN-generate-correcting](../reference/planning/generation.md#plan-generate-correcting) and
[PLAN-generate-no-mix](../reference/planning/generation.md#plan-generate-no-mix).

## Link

`KrameriusLink`: a PID or viewer address to the canonical link, naming which Kramerius. An
iteration may hold several links ([DEC-0014](../decisions/DEC-0014-several-publication-links.md)).

## Publication detector

`Kramerius72XPublicationDetector`.

## Message

`MailtoMessage` · `SlackMessage` · `SlackBotMessage` (VERA's Slack app posts a direct message to
the recipients; its result is *sent*).

### `MailtoMessage`

`cc_sender` is `on` or `off`. `handOff` returns a `mailto:` address with the supplied recipient
addresses, subject and text URL-encoded; when enabled, the caller's email is added as the `cc`
address ([PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds)). The hand-off
does not send or retain a message ([MSG-handoff](../reference/integrations/messaging.md#msg-handoff),
[MSG-keeps-nothing](../reference/integrations/messaging.md#msg-keeps-nothing)).

## Delivery channel

| Implementation | Notes |
|---|---|
| `HttpWebhook` | |
| `SlackNotifier` | |
| `SftpDrop` | |
| `SmtpMailer` | SMTP with optional password login; opens its own connection |
| `GmailAccountMailer` | the Gmail API with an OAuth2 client from Google Cloud Console; send-only scope |
