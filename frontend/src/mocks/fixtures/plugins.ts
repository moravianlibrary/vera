// Plugins' implementations and instances (docs/demos/shared/vera-data.js `pluginTypes`;
// plugins.md §1, §4): every instance other records name, in one place, with its configuration,
// VERA's settings on it and when it last ran. The Identity instances carry the login page's
// label and order, the default role and the claim mappings (identity.md §1); each Custody rule the
// custody it picks; the Message and Classifier instances their order. The two
// classifiers are not in the demo (the kind is new on 2026-10-07). A run still on Tasks says when
// an instance last ran; `lastRunAt` holds it for those whose runs are not there.
// Also the packages the mock "reads" when one is uploaded, by file name: the next version of an
// implementation, with what it adds and retires, and two new implementations, one built against
// a contract VERA does not run.

import type { InstanceSettings, PluginVersion } from "@vera/contract/plugins";
import type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";
import type { ConfigField, Declarations, PluginKind, PluginTrigger } from "@vera/domain/plugins";

export type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";

// June 2026, in the library's own time.
function june(day: number, hours: number, minutes: number): Date {
  return new Date(2026, 5, day, hours, minutes);
}

const noDeclarations: Declarations = {
  properties: [],
  identifierTypes: [],
  rawStates: [],
  rules: [],
  agent: null,
  generatorClass: null,
  channelInterface: null,
  operations: [],
  loginEntry: null,
};

function fields(...keys: readonly string[]): ConfigField[] {
  return keys.map((key) => ({
    key: key.replace(/[*?]/g, ""),
    isSecret: key.endsWith("*"),
    isRequired: !key.endsWith("?"),
  }));
}

interface VersionSource {
  readonly version: string;
  readonly installedAt: string;
  readonly triggers: readonly PluginTrigger[];
  readonly declares?: Partial<Declarations>;
  // A key ending in `*` is a secret, in `?` optional.
  readonly fields: readonly string[];
}

function versionOf(source: VersionSource): PluginVersion {
  return {
    version: source.version,
    contractVersion: "1.0",
    installedAt: source.installedAt,
    installedBy: "u3",
    triggers: [...source.triggers],
    declares: { ...noDeclarations, ...source.declares },
    configFields: fields(...source.fields),
  };
}

function implementation(
  id: string,
  name: string,
  kind: PluginKind,
  description: string,
  ...versions: readonly VersionSource[]
): StoredPluginImplementation {
  const legacyDescriptorSlugs: Readonly<Record<string, string>> = {
    pt1: "aleph-catalog-adapter",
    pt3: "rdczregistry",
    pt5: "issnharvester",
    pt6: "catalog-validity",
    pt7: "language-check",
    pt14: "mailgun-mailer",
    pt25: "copyright-rule",
    pt26: "kramerius-harvester",
    pt30: "kramerius-publication-detector",
  };
  const slug =
    legacyDescriptorSlugs[id] ?? name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return {
    id,
    descriptorId: `cz.mzk.vera.${slug}`,
    name,
    kind,
    description,
    versions: versions.map(versionOf),
  };
}

const catalogTriggers = ["OnProposal", "OnIngest", "OnSchedule", "OnDemand"] as const;
const registryTriggers = ["OnProposal", "OnIngest", "OnSchedule"] as const;

export const pluginImplementations: readonly StoredPluginImplementation[] = [
  implementation("pt1", "AlephOaiCatalogAdapter", "CatalogAdapter", "Connects to live MZK Aleph.", {
    version: "2.4.1",
    installedAt: "2026-01-15",
    triggers: catalogTriggers,
    declares: {
      properties: [
        { key: "page_count", tier: 50 },
        { key: "material_type", tier: 50 },
        { key: "shelf_mark", tier: 50 },
        { key: "title", tier: 50 },
        { key: "unit_enumeration", tier: 50 },
      ],
      identifierTypes: ["NBN", "ISSN", "ISBN", "Shelf mark"],
      operations: ["readLink", "search"],
    },
    fields: ["base_url", "protocol", "timeout", "search?"],
  }),
  implementation(
    "pt2",
    "KrameriusRegistry",
    "Registry",
    "Asks a Kramerius instance whether a record is already published.",
    {
      version: "1.8.0",
      installedAt: "2026-01-15",
      triggers: registryTriggers,
      declares: {
        rawStates: [
          { raw: "published", state: "Published", isExistingCopy: true },
          { raw: "(absent)", state: "NotFound", isExistingCopy: false },
        ],
      },
      fields: ["base_url", "link"],
    },
  ),
  implementation(
    "pt3",
    "RdczRegistry",
    "Registry",
    "Reports what other libraries plan and hold in the national digitization registry.",
    {
      version: "1.2.3",
      installedAt: "2026-01-15",
      triggers: registryTriggers,
      declares: {
        rawStates: [
          { raw: "Planned", state: "Planned", isExistingCopy: false },
          { raw: "InProgress", state: "InProgress", isExistingCopy: false },
          { raw: "Digitized", state: "Digitized", isExistingCopy: true },
          { raw: "Revision", state: null, isExistingCopy: false },
        ],
      },
      fields: ["base_url", "link"],
    },
  ),
  implementation(
    "pt4",
    "PageCountPredictor",
    "PropertySource",
    "Estimates an extent from material type, year and format when no catalogue extent exists.",
    {
      version: "0.9.2",
      installedAt: "2026-03-03",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule"],
      declares: { properties: [{ key: "page_count", tier: 20 }] },
      fields: ["model", "min_confidence"],
    },
  ),
  implementation(
    "pt5",
    "PeriodicalGaps",
    "Harvester",
    "Finds missing volumes of periodicals partly digitized in Kramerius.",
    {
      version: "1.0.4",
      installedAt: "2026-04-11",
      triggers: ["OnSchedule", "OnDemand"],
      declares: {
        identifierTypes: ["ISSN"],
        agent: { name: "Periodical gaps", entryPoint: "proposals" },
      },
      fields: ["region", "since", "max"],
    },
  ),
  implementation(
    "pt26",
    "DnntoFromSdnnt",
    "Harvester",
    "Finds documents with DNNTO in SDNNT that no library has digitized.",
    {
      version: "1.0.0",
      installedAt: "2026-01-15",
      triggers: ["OnSchedule", "OnDemand"],
      declares: {
        identifierTypes: ["Catalog ID"],
        agent: { name: "Kramerius sweep", entryPoint: "additions" },
      },
      fields: ["base_url", "since", "max"],
    },
  ),
  implementation(
    "pt6",
    "MarcComparator",
    "Validation",
    "Validates a record against SKC and ČNB through the MARC comparator application.",
    {
      version: "3.1.0",
      installedAt: "2026-01-15",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"],
      declares: {
        rules: [
          { code: "R03", label: "title well-formed" },
          { code: "R07", label: "publication year resolvable" },
          { code: "R11", label: "extent matches what was delivered", reads: ["page_count"] },
        ],
      },
      fields: ["severity", "rules"],
    },
  ),
  implementation(
    "pt7",
    "FieldsCompleteness",
    "Validation",
    "Checks required fields for each issuance type.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"],
      declares: { rules: [{ code: "R01", label: "language recorded" }] },
      fields: ["severity"],
    },
  ),
  implementation(
    "pt25",
    "ForbiddenByRecordValue",
    "Restriction",
    "Forbids digitizing when a field or subfield holds a given value.",
    {
      version: "1.0.0",
      installedAt: "2026-06-10",
      triggers: ["OnProposal", "OnIngest", "OnRecordChange", "OnSchedule"],
      declares: {
        rules: [
          { code: "C70", label: "author or editor died less than 70 years ago" },
          { code: "C-UNK", label: "no death date and published after 1900" },
        ],
      },
      fields: ["years", "unknown_after", "authority"],
    },
  ),
  implementation(
    "pt19",
    "JqCustody",
    "Custody",
    "Evaluates one jq condition over the proposal as JSON; when it holds, the proposal is in the custody the instance picks.",
    {
      version: "1.0.0",
      installedAt: "2026-06-23",
      triggers: ["OnProposal", "OnRecordChange"],
      fields: ["expr"],
    },
  ),
  implementation(
    "pt9",
    "BarcodeReader",
    "Input",
    "Reads EAN-13 (ISBN), ISSN and library barcodes from the device camera. A hardware scanner needs no plugin — it types like a keyboard.",
    {
      version: "0.8.1",
      installedAt: "2026-02-04",
      triggers: ["OnDemand"],
      declares: {
        identifierTypes: ["ISBN", "ISSN", "Barcode"],
        operations: ["readBarcode"],
      },
      fields: ["formats", "beep"],
    },
  ),
  implementation(
    "pt10",
    "CoverRecognition",
    "Input",
    "Reads a photo of a cover, title page or catalog card — identifiers, and the text itself (title, author, place, year, shelf mark) — and matches it to catalog records.",
    {
      version: "0.3.0",
      installedAt: "2026-09-10",
      triggers: ["OnDemand"],
      declares: {
        identifierTypes: ["ISBN", "ISSN", "NBN"],
        operations: ["readPhoto"],
      },
      fields: ["engine", "lang", "match"],
    },
  ),
  implementation(
    "pt11",
    "PriorityThenMix",
    "ListGenerator",
    "Fills each category to its share, highest priority first, then the oldest ask. Deterministic.",
    {
      version: "1.2.0",
      installedAt: "2026-01-15",
      triggers: ["OnDemand"],
      declares: { generatorClass: "RuleBased" },
      fields: ["tolerance", "order"],
    },
  ),
  implementation(
    "pt12",
    "ShelfAdvisor",
    "ListGenerator",
    "A model reads the pool and proposes a list, giving its own reason for every pick. Not deterministic.",
    {
      version: "0.4.0",
      installedAt: "2026-09-01",
      triggers: ["OnDemand"],
      declares: { generatorClass: "AiBased" },
      fields: ["model", "tolerance"],
    },
  ),
  implementation(
    "pt20",
    "OidcIdentity",
    "Identity",
    "Logs in through an OpenID Connect provider — Keycloak, or any other.",
    {
      version: "2.1.0",
      installedAt: "2026-01-15",
      triggers: ["OnLogin"],
      declares: { loginEntry: "Redirect" },
      fields: ["issuer", "client", "client_secret*"],
    },
  ),
  implementation(
    "pt22",
    "LocalAccounts",
    "Identity",
    "Usernames and passwords kept by VERA — for people with no institutional account.",
    {
      version: "1.0.0",
      installedAt: "2026-01-15",
      triggers: ["OnLogin"],
      declares: { loginEntry: "Form" },
      fields: ["signup", "password_min", "mail_channel"],
    },
  ),
  // PLG-kinds: Link and Publication detector (decided 2026-10-15, not in the demo).
  implementation(
    "pt29",
    "KrameriusLink",
    "Link",
    "Reads a Kramerius PID or viewer address and gives the item's canonical link there.",
    { version: "1.0.0", installedAt: "2026-10-16", triggers: ["OnDemand"], fields: ["base_url"] },
  ),
  implementation(
    "pt30",
    "Kramerius72XPublicationDetector",
    "PublicationDetector",
    "Detects publications from Kramerius 72X fields.",
    {
      version: "1.0.0",
      installedAt: "2026-10-16",
      triggers: ["OnSchedule", "OnDemand"],
      fields: ["base_url", "since?"],
    },
  ),
  // DOC-identifiers: built in, one instance per identifier type.
  implementation(
    "pt31",
    "Pattern",
    "Identifier",
    "Recognises one identifier type by a regular expression after normalising the value, with an optional checksum, and names the type in each language.",
    {
      version: "1.0.0",
      installedAt: "2026-01-15",
      triggers: ["OnDemand"],
      fields: ["type", "label_en", "label_cs", "pattern", "normalisation?", "checksum?"],
    },
  ),
  implementation(
    "pt23",
    "MailtoMessage",
    "Message",
    "Opens the person's mail client with the recipients, subject and a link back filled in.",
    { version: "1.0.0", installedAt: "2026-06-24", triggers: ["OnDemand"], fields: ["cc_sender"] },
  ),
  implementation(
    "pt24",
    "SlackMessage",
    "Message",
    "Opens a Slack DM, or a group DM, with the recipients — a deep link with the text pre-filled.",
    {
      version: "0.5.0",
      installedAt: "2026-06-24",
      triggers: ["OnDemand"],
      fields: ["workspace", "handle"],
    },
  ),
  implementation(
    "pt39",
    "SlackBotMessage",
    "Message",
    "Posts a direct message to reachable Slack recipients.",
    { version: "1.0.0", installedAt: "2026-10-30", triggers: ["OnDemand"], fields: ["workspace"] },
  ),
  implementation("pt13", "SmtpMailer", "DeliveryChannel", "Sends mail through an SMTP server.", {
    version: "1.1.0",
    installedAt: "2026-01-15",
    triggers: ["OnEvent"],
    declares: { channelInterface: "Email", personReach: { by: "email" } },
    fields: ["host", "port", "from", "tls"],
  }),
  implementation(
    "pt14",
    "GmailAccountMailer",
    "DeliveryChannel",
    "Sends mail through the Gmail API with a send-only OAuth2 client.",
    {
      version: "0.6.2",
      installedAt: "2026-05-02",
      triggers: ["OnEvent"],
      declares: { channelInterface: "Email", personReach: { by: "email" } },
      fields: ["domain", "region", "from", "api_key*"],
    },
  ),
  implementation("pt15", "SlackNotifier", "DeliveryChannel", "Posts to a Slack channel as a bot.", {
    version: "1.0.3",
    installedAt: "2026-06-03",
    triggers: ["OnEvent"],
    declares: { channelInterface: "Chat", personReach: { by: "claim", claim: "slack_id" } },
    fields: ["workspace", "bot", "token*"],
  }),
  implementation(
    "pt17",
    "HttpWebhook",
    "DeliveryChannel",
    "POSTs the event as JSON, signed with a shared secret.",
    {
      version: "2.0.1",
      installedAt: "2026-01-15",
      triggers: ["OnEvent"],
      declares: { channelInterface: "Webhook" },
      fields: ["timeout", "sign", "secret*"],
    },
  ),
  implementation("pt18", "SftpDrop", "DeliveryChannel", "Writes a file to an SFTP folder.", {
    version: "1.0.0",
    installedAt: "2026-03-01",
    triggers: ["OnEvent"],
    declares: { channelInterface: "File" },
    fields: ["host", "user", "key", "format"],
  }),
  implementation(
    "pt27",
    "PlaceOfPublication",
    "Classifier",
    "Suggests the regional line for a periodical published in a Moravian place.",
    { version: "1.0.0", installedAt: "2026-10-07", triggers: ["OnProposal"], fields: ["places"] },
  ),
  implementation(
    "pt28",
    "MaterialType",
    "Classifier",
    "Suggests a leaf by material type: periodicals and maps; a monograph needs its period.",
    { version: "1.1.0", installedAt: "2026-10-07", triggers: ["OnProposal"], fields: ["table"] },
  ),
  implementation(
    "pt32",
    "EntryLink",
    "Input",
    "Lets an outside portal link into Propose with an item filled in (ACT-entry-link).",
    {
      version: "1.0.0",
      installedAt: "2026-10-29",
      triggers: ["OnDemand"],
      fields: ["allowed_origins"],
      declares: { operations: ["entry"] },
    },
  ),
  implementation("pt40", "ShelfMarkRecognition", "Input", "Recognises shelf marks on spines.", {
    version: "1.0.0",
    installedAt: "2026-06-02",
    triggers: ["OnDemand"],
    declares: { operations: ["readPhoto"] },
    fields: [],
  }),
  implementation("pt41", "CatalogCardRecognition", "Input", "Recognises catalog cards.", {
    version: "1.0.0",
    installedAt: "2026-06-02",
    triggers: ["OnDemand"],
    declares: { operations: ["readPhoto"] },
    fields: [],
  }),
  implementation(
    "pt42",
    "DnntoFromCatalog",
    "Harvester",
    "Finds MZK records that could get the DNNTO licence if digitized.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnSchedule", "OnDemand"],
      fields: [],
    },
  ),
  implementation(
    "pt43",
    "SftpFile",
    "Harvester",
    "Finds new files in an SFTP directory (CSV or TXT).",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnSchedule", "OnDemand"],
      fields: [],
    },
  ),
  implementation(
    "pt44",
    "GoogleSheet",
    "Harvester",
    "Finds new rows of a Google Sheet through a service account.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnSchedule", "OnDemand"],
      fields: [],
    },
  ),
  implementation(
    "pt45",
    "XmlDumpCatalogAdapter",
    "CatalogAdapter",
    "Reads a downloaded catalog dump refreshed on schedule; the reading's date is the dump's.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: catalogTriggers,
      fields: [],
    },
  ),
  implementation(
    "pt46",
    "MarcExtentPageCount",
    "PropertySource",
    "Parses page count from 300 $a.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule"],
      fields: [],
    },
  ),
  implementation(
    "pt47",
    "SiblingVolumePageCount",
    "PropertySource",
    "Estimates periodical page count as the median of the title's volumes already digitized.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule"],
      fields: [],
    },
  ),
  implementation(
    "pt48",
    "ShelfMarkToSize",
    "PropertySource",
    "Derives size from the shelf mark's prefix.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule"],
      fields: [],
    },
  ),
  implementation(
    "pt49",
    "JqProperty",
    "PropertySource",
    "Reads any property by a jq expression over the record.",
    {
      version: "1.0.0",
      installedAt: "2026-06-02",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule"],
      fields: [],
    },
  ),
];

// ---------------------------------------------------------------- instances

interface InstanceSource {
  readonly id: string;
  readonly name: string;
  readonly implementationId: string;
  readonly configuration: Readonly<Record<string, string>>;
  readonly linkedCategoryId?: string | null;
  readonly triggers: readonly PluginTrigger[];
  readonly settings?: InstanceSettings;
  readonly createdBy?: string;
  readonly createdAt: string;
  readonly lastRunAt: Date | null;
  readonly isPredefined?: boolean;
}

function instance(source: InstanceSource): StoredPluginInstance {
  const implementationOf = pluginImplementations.find(
    (candidate) => candidate.id === source.implementationId,
  );
  return {
    ...source,
    version: implementationOf?.versions[0]?.version ?? "1.0.0",
    isEnabled: true,
    linkedCategoryId: source.linkedCategoryId ?? null,
    settings: source.settings ?? null,
    createdBy: source.createdBy ?? "u3",
    isDeleted: false,
  };
}

// DOC-identifiers: one predefined Pattern instance per type, with MZK's formats.
const identifierSources: readonly Pick<InstanceSource, "id" | "name" | "configuration">[] = [
  {
    id: "pi36",
    name: "Catalog ID",
    configuration: {
      type: "catalogId",
      label_en: "Catalog ID",
      label_cs: "Systémové číslo",
      pattern: "[A-Z]{3,4}\\d{2}-\\d{9}",
      normalisation: "trim,upperCase",
    },
  },
  {
    id: "pi37",
    name: "NBN",
    configuration: {
      type: "nbn",
      label_en: "NBN",
      label_cs: "ČNB",
      pattern: "[Cc][Nn][Bb]\\d{9}",
      normalisation: "trim",
    },
  },
  {
    id: "pi38",
    name: "ISBN",
    configuration: {
      type: "isbn",
      label_en: "ISBN",
      label_cs: "ISBN",
      pattern: "97[89]\\d{10}",
      normalisation: "trim,dropHyphens",
      checksum: "isbn13",
    },
  },
  {
    id: "pi39",
    name: "ISSN",
    configuration: {
      type: "issn",
      label_en: "ISSN",
      label_cs: "ISSN",
      pattern: "\\d{4}-\\d{3}[\\dX]",
      normalisation: "trim,upperCase",
      checksum: "issn",
    },
  },
  {
    id: "pi40",
    name: "Barcode",
    configuration: {
      type: "barcode",
      label_en: "Barcode",
      label_cs: "Čárový kód",
      pattern: "MZK-\\d{4}-\\d{6}",
      normalisation: "trim,upperCase",
    },
  },
];

export const pluginInstances: readonly StoredPluginInstance[] = [
  instance({
    id: "pi1",
    name: "MZK Aleph",
    implementationId: "pt1",
    configuration: { base_url: "aleph.mzk.cz", protocol: "REST", timeout: "30s" },
    triggers: ["OnDemand"],
    createdAt: "2026-01-15",
    lastRunAt: null,
  }),
  instance({
    id: "pi2",
    name: "NKP Aleph",
    implementationId: "pt1",
    configuration: { base_url: "aleph.nkp.cz", protocol: "Z39.50", timeout: "45s", search: "off" },
    triggers: ["OnDemand"],
    createdAt: "2026-01-15",
    lastRunAt: june(25, 10, 30),
  }),
  instance({
    id: "pi3",
    name: "VKOL Aleph",
    implementationId: "pt1",
    configuration: { base_url: "aleph.vkol.cz", protocol: "REST", timeout: "30s" },
    triggers: ["OnDemand"],
    createdAt: "2026-02-20",
    lastRunAt: june(7, 10, 30),
  }),
  instance({
    id: "pi4",
    name: "MZK Kramerius",
    implementationId: "pt2",
    configuration: { base_url: "kramerius.mzk.cz", link: "content" },
    triggers: ["OnIngest"],
    createdAt: "2026-01-15",
    lastRunAt: null,
  }),
  instance({
    id: "pi5",
    name: "RDCZ production",
    implementationId: "pt3",
    configuration: { base_url: "registrdigitalizace.cz", link: "record" },
    triggers: ["OnIngest"],
    createdAt: "2026-01-15",
    lastRunAt: null,
  }),
  instance({
    id: "pi6",
    name: "Periodicals model",
    implementationId: "pt4",
    configuration: { model: "periodical-v3", min_confidence: "0.6" },
    linkedCategoryId: "c2",
    triggers: ["OnIngest"],
    createdBy: "u2",
    createdAt: "2026-03-03",
    lastRunAt: june(21, 14, 12),
  }),
  instance({
    id: "pi7",
    name: "Monographs model",
    implementationId: "pt4",
    configuration: { model: "monograph-v1", min_confidence: "0.75" },
    linkedCategoryId: "c1",
    triggers: ["OnIngest"],
    createdBy: "u2",
    createdAt: "2026-03-03",
    lastRunAt: june(19, 9, 5),
  }),
  instance({
    id: "pi8",
    name: "Moravian periodicals",
    implementationId: "pt5",
    configuration: { region: "CZ-64", since: "1850", max: "50/run" },
    linkedCategoryId: "c21",
    triggers: [],
    createdBy: "u2",
    createdAt: "2026-04-11",
    lastRunAt: null,
  }),
  instance({
    id: "pi29",
    name: "MZK Kramerius sweep",
    implementationId: "pt26",
    configuration: { base_url: "kramerius.mzk.cz", since: "last run", max: "200/run" },
    triggers: [],
    createdAt: "2026-01-15",
    lastRunAt: june(25, 2, 0),
  }),
  instance({
    id: "pi9",
    name: "Default ruleset",
    implementationId: "pt6",
    configuration: { severity: "blocking", rules: "R03,R07,R11" },
    triggers: ["OnIngest"],
    createdAt: "2026-01-15",
    lastRunAt: null,
  }),
  instance({
    id: "pi10",
    name: "Language check",
    implementationId: "pt7",
    configuration: { severity: "advisory" },
    triggers: ["OnIngest"],
    createdAt: "2026-06-02",
    lastRunAt: june(25, 10, 38),
  }),
  instance({
    id: "pi28",
    name: "Czech copyright",
    implementationId: "pt25",
    configuration: { years: "70", unknown_after: "1900", authority: "NKC" },
    triggers: ["OnProposal", "OnIngest"],
    createdAt: "2026-06-10",
    lastRunAt: june(21, 11, 2),
  }),
  // ACCESS-custody-by-plugins: one rule per custody, each a condition and the custody it picks.
  instance({
    id: "pi25",
    name: "Serials",
    implementationId: "pt19",
    configuration: { expr: '.document.type == "Periodical"' },
    triggers: ["OnProposal"],
    settings: { kind: "Custody", custodyId: "pc1" },
    createdAt: "2026-06-23",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi34",
    name: "Printed 1800–1899",
    implementationId: "pt19",
    configuration: { expr: '.record.fields."260".c // "" | test("^18")' },
    triggers: ["OnProposal", "OnRecordChange"],
    settings: { kind: "Custody", custodyId: "pc2" },
    createdAt: "2026-06-23",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi35",
    name: "Moravica project",
    implementationId: "pt19",
    configuration: { expr: '.request.project == "Moravica"' },
    triggers: ["OnProposal"],
    settings: { kind: "Custody", custodyId: "pc3" },
    createdAt: "2026-06-23",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi12",
    name: "Camera",
    implementationId: "pt9",
    configuration: { formats: "ean13,code128", beep: "on" },
    triggers: ["OnDemand"],
    createdAt: "2026-02-04",
    lastRunAt: june(25, 7, 40),
  }),
  instance({
    id: "pi13",
    name: "OCR pilot",
    implementationId: "pt10",
    configuration: { engine: "tesseract", lang: "ces+deu+lat", match: "catalog" },
    triggers: ["OnDemand"],
    createdAt: "2026-09-10",
    lastRunAt: june(23, 10, 40),
  }),
  instance({
    id: "pi14",
    name: "Priority, then age",
    implementationId: "pt11",
    configuration: { tolerance: "5%", order: "priority,asked" },
    triggers: ["OnDemand"],
    createdAt: "2026-01-15",
    lastRunAt: null,
  }),
  instance({
    id: "pi15",
    name: "Pilot",
    implementationId: "pt12",
    configuration: { model: "vera-advisor-2", tolerance: "8%" },
    triggers: ["OnDemand"],
    createdAt: "2026-09-01",
    lastRunAt: june(22, 10, 15),
  }),
  instance({
    id: "pi22",
    name: "MZK Keycloak",
    implementationId: "pt20",
    configuration: {
      issuer: "sso.mzk.cz/realms/mzk",
      client: "vera",
      client_secret: "kc-3f1d9a7e",
    },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with MZK account",
      order: 1,
      userIdClaim: "preferred_username",
      defaultRoleId: null,
      matchByEmail: false,
      mappings: [
        { claim: "group mzk-staff", roleId: "staff" },
        { claim: "group mzk-curators", roleId: "curator" },
        { claim: "group mzk-digitization", roleId: "dig-curator" },
      ],
    },
    createdAt: "2026-01-15",
    lastRunAt: june(25, 10, 36),
  }),
  instance({
    id: "pi24",
    name: "Local accounts",
    implementationId: "pt22",
    configuration: { signup: "on", password_min: "12", mail_channel: "pi16" },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with a VERA account",
      order: 3,
      userIdClaim: "username",
      defaultRoleId: "reader",
      matchByEmail: false,
      mappings: [],
    },
    createdAt: "2026-01-15",
    lastRunAt: june(25, 8, 40),
  }),
  instance({
    id: "pi41",
    name: "Google",
    implementationId: "pt20",
    configuration: { issuer: "accounts.google.com", client: "vera-mzk", client_secret: "g-7c2e" },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with Google",
      order: 4,
      userIdClaim: "sub",
      defaultRoleId: "reader",
      matchByEmail: true,
      mappings: [],
    },
    createdAt: "2026-10-29",
    lastRunAt: null,
  }),
  instance({
    id: "pi42",
    name: "Seznam",
    implementationId: "pt20",
    configuration: { issuer: "login.szn.cz", client: "vera-mzk", client_secret: "s-41b9" },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with Seznam",
      order: 5,
      userIdClaim: "sub",
      defaultRoleId: "reader",
      matchByEmail: false,
      mappings: [],
    },
    createdAt: "2026-10-29",
    lastRunAt: null,
  }),
  instance({
    id: "pi26",
    name: "Email",
    implementationId: "pt23",
    configuration: { cc_sender: "off" },
    triggers: ["OnDemand"],
    settings: { kind: "Message", order: 1 },
    createdAt: "2026-06-24",
    lastRunAt: null,
  }),
  instance({
    id: "pi27",
    name: "MZK Slack",
    implementationId: "pt24",
    configuration: { workspace: "mzk", handle: "claim slack_id" },
    triggers: ["OnDemand"],
    settings: { kind: "Message", order: 2 },
    createdAt: "2026-06-24",
    lastRunAt: null,
  }),
  instance({
    id: "pi44",
    name: "MZK Slack bot",
    implementationId: "pt39",
    configuration: { workspace: "mzk" },
    triggers: ["OnDemand"],
    settings: { kind: "Message", order: 3 },
    createdAt: "2026-10-30",
    lastRunAt: null,
  }),
  instance({
    id: "pi16",
    name: "MZK SMTP",
    implementationId: "pt13",
    configuration: { host: "smtp.mzk.cz", port: "587", from: "vera@mzk.cz", tls: "starttls" },
    triggers: ["OnEvent"],
    createdAt: "2026-01-15",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi17",
    name: "Mailgun — requesters",
    implementationId: "pt14",
    configuration: {
      domain: "mg.mzk.cz",
      region: "eu",
      from: "noreply@mg.mzk.cz",
      api_key: "key-8c2e41b0",
    },
    triggers: ["OnEvent"],
    createdAt: "2026-05-02",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi18",
    name: "MZK Slack",
    implementationId: "pt15",
    configuration: { workspace: "mzk", bot: "vera", token: "xoxb-5521-vera" },
    triggers: ["OnEvent"],
    createdAt: "2026-06-03",
    lastRunAt: june(14, 9, 12),
  }),
  instance({
    id: "pi20",
    name: "Webhooks",
    implementationId: "pt17",
    configuration: { timeout: "10s", sign: "hmac-sha256", secret: "whsec-a90c" },
    triggers: ["OnEvent"],
    createdAt: "2026-01-15",
    lastRunAt: june(20, 13, 45),
  }),
  instance({
    id: "pi21",
    name: "Scan-ops SFTP",
    implementationId: "pt18",
    configuration: { host: "scan-ops", user: "vera", key: "vera_rsa", format: "csv" },
    triggers: ["OnEvent"],
    createdBy: "u2",
    createdAt: "2026-03-01",
    lastRunAt: new Date(2026, 4, 20, 7, 0),
  }),
  instance({
    id: "pi30",
    name: "Regional press",
    implementationId: "pt27",
    configuration: { places: "morav,brn,ostrav,olomou,znojm,slovác" },
    triggers: ["OnProposal"],
    settings: { kind: "Classifier", order: 1 },
    createdAt: "2026-10-07",
    lastRunAt: june(24, 15, 10),
  }),
  instance({
    id: "pi32",
    name: "Digitální knihovna MZK",
    implementationId: "pt29",
    configuration: { base_url: "https://www.digitalniknihovna.cz/mzk" },
    triggers: ["OnDemand"],
    createdAt: "2026-10-16",
    lastRunAt: null,
  }),
  instance({
    id: "pi33",
    name: "MZK Kramerius publications",
    implementationId: "pt30",
    configuration: { base_url: "https://kramerius.mzk.cz" },
    triggers: ["OnSchedule", "OnDemand"],
    createdAt: "2026-10-16",
    lastRunAt: null,
  }),
  // DOC-identifiers: MZK's formats, predefined, their order deciding detection.
  ...identifierSources.map((source, index) =>
    instance({
      ...source,
      implementationId: "pt31",
      triggers: ["OnDemand"],
      settings: { kind: "Identifier", order: index + 1 },
      createdAt: "2026-01-15",
      lastRunAt: null,
      isPredefined: true,
    }),
  ),
  instance({
    id: "pi31",
    name: "Material type",
    implementationId: "pt28",
    configuration: { table: "periodical→c22, map→c4" },
    triggers: ["OnProposal"],
    settings: { kind: "Classifier", order: 2 },
    createdAt: "2026-10-07",
    lastRunAt: june(24, 15, 10),
  }),
  instance({
    id: "pi43",
    name: "Tlačítko digitalizovat",
    implementationId: "pt32",
    configuration: {
      allowed_origins: "https://www.mzk.cz https://tlacitko.osdd.mzk.cz",
    },
    triggers: ["OnDemand"],
    createdAt: "2026-10-29",
    lastRunAt: null,
  }),
];

// ---------------------------------------------------------------- packages

// What the next version of an implementation declares beyond its newest, when one is uploaded.
export interface NextVersionChange {
  readonly declares?: Partial<Declarations>;
  readonly fields?: readonly string[];
}

export const nextVersionChanges: Readonly<Record<string, NextVersionChange>> = {
  // R11 retired: its approvals then cover nothing (plugins.md §2.6).
  pt6: {
    declares: {
      rules: [
        { code: "R03", label: "title well-formed" },
        { code: "R07", label: "publication year resolvable" },
        { code: "R12", label: "shelf mark present" },
      ],
    },
  },
  pt1: { fields: ["base_url", "protocol", "timeout", "search?", "retries?"] },
};

// Packages of implementations VERA does not have yet, by the name in the file.
export interface NewPackage {
  readonly name: string;
  readonly kind: PluginKind;
  readonly description: string;
  readonly contractVersion: string;
  readonly triggers: readonly PluginTrigger[];
  readonly declares: Partial<Declarations>;
  readonly fields: readonly string[];
}

export const newPackages: Readonly<Record<string, NewPackage>> = {
  "oai-pmh-harvester": {
    name: "OaiPmhHarvester",
    kind: "Harvester",
    description: "Harvests an OAI-PMH endpoint for records in a set, and proposes what is new.",
    contractVersion: "1.0",
    triggers: ["OnSchedule", "OnDemand"],
    declares: {
      identifierTypes: ["Catalog ID"],
      agent: { name: "OAI-PMH harvester", entryPoint: "proposals" },
    },
    fields: ["endpoint", "set", "since"],
  },
  "kramerius7-registry": {
    name: "Kramerius7Registry",
    kind: "Registry",
    description: "Asks a Kramerius 7 instance whether a record is published, through its new API.",
    contractVersion: "2.0",
    triggers: ["OnProposal", "OnIngest", "OnSchedule"],
    declares: {
      rawStates: [
        { raw: "published", state: "Published", isExistingCopy: true },
        { raw: "(absent)", state: "NotFound", isExistingCopy: false },
      ],
    },
    fields: ["base_url", "link"],
  },
};

export { fields as configFieldsOf, noDeclarations };
