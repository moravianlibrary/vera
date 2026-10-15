// Plugins' implementations and instances (docs/demos/shared/vera-data.js `pluginTypes`;
// plugins.md §1, §4): every instance other records name, in one place, with its configuration,
// VERA's settings on it and when it last ran. The Identity instances carry the login page's
// label and order, the default role and the claim mappings (identity.md §1); the Custody rule the
// custody names it returns; the Message and Classifier instances their order. The two
// classifiers are not in the demo (the kind is new on 2026-10-07). A run still on Tasks says when
// an instance last ran; `lastRunAt` holds it for those whose runs are not there.
// Also the packages the mock "reads" when one is uploaded, by file name: the next version of an
// implementation, with what it adds and retires, and two new implementations, one built against
// a contract VERA does not run.

import type { InstanceSettings, PluginVersion } from "@/api/plugins";
import type { ConfigField, Declarations, PluginKind, PluginTrigger } from "@/domain/plugins";

export interface StoredPluginImplementation {
  readonly id: string;
  readonly descriptorId: string;
  readonly name: string;
  readonly kind: PluginKind;
  readonly description: string;
  // Newest first.
  readonly versions: readonly PluginVersion[];
}

export interface StoredPluginInstance {
  readonly id: string;
  readonly name: string;
  readonly implementationId: string;
  readonly version: string;
  readonly isEnabled: boolean;
  // With the secrets, which the server never sends back.
  readonly configuration: Readonly<Record<string, string>>;
  readonly linkedCategoryId: string | null;
  readonly triggers: readonly PluginTrigger[];
  readonly settings: InstanceSettings | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastRunAt: Date | null;
  // A deleted instance is kept, so the runs it made still name it.
  readonly isDeleted: boolean;
}

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
  inputMode: null,
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
  const slug = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
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
  implementation(
    "pt1",
    "AlephCatalogAdapter",
    "CatalogAdapter",
    "Adapter for the Aleph ILS. Speaks Z39.50 and REST; enumerates units.",
    {
      version: "2.4.1",
      installedAt: "2026-01-15",
      triggers: catalogTriggers,
      declares: {
        properties: [
          { key: "page_count", tier: 50 },
          { key: "material_type", tier: 50 },
          { key: "unit_enumeration", tier: 50 },
        ],
        identifierTypes: ["NBN", "ISSN", "ISBN", "Shelf mark"],
      },
      fields: ["base_url", "protocol", "timeout", "search?"],
    },
  ),
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
    "RDCZRegistry",
    "Registry",
    "The national digitization registry. Reports what other libraries plan and hold.",
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
    "ISSNHarvester",
    "Harvester",
    "Watches the ISSN portal for new titles in scope and proposes them.",
    {
      version: "1.0.4",
      installedAt: "2026-04-11",
      triggers: ["OnSchedule", "OnDemand"],
      declares: {
        identifierTypes: ["ISSN"],
        agent: { name: "ISSN harvester", entryPoint: "proposals" },
      },
      fields: ["region", "since", "max"],
    },
  ),
  implementation(
    "pt26",
    "KrameriusHarvester",
    "Harvester",
    "Finds what a Kramerius instance published that VERA does not hold, and adds it.",
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
    "CatalogValidity",
    "Validation",
    "Checks a catalogue record is complete enough to digitize against.",
    {
      version: "3.1.0",
      installedAt: "2026-01-15",
      triggers: ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"],
      declares: {
        rules: [
          { code: "R03", label: "title well-formed" },
          { code: "R07", label: "publication year resolvable" },
          { code: "R11", label: "extent matches what was delivered" },
        ],
      },
      fields: ["severity", "rules"],
    },
  ),
  implementation("pt7", "LanguageCheck", "Validation", "Flags records with no language recorded.", {
    version: "1.0.0",
    installedAt: "2026-06-02",
    triggers: ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"],
    declares: { rules: [{ code: "R01", label: "language recorded" }] },
    fields: ["severity"],
  }),
  implementation(
    "pt25",
    "CopyrightRule",
    "Restriction",
    "Forbids what is still in copyright: the last known author or editor died less than 70 years ago.",
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
    "Evaluates one jq expression over the proposal as JSON; it returns the names of the custodies it belongs in.",
    {
      version: "1.0.0",
      installedAt: "2026-06-23",
      triggers: ["OnProposal", "OnRecordChange"],
      fields: ["expr"],
    },
  ),
  implementation(
    "pt8",
    "IdentifierDetector",
    "Input",
    "Recognises which identifier each pasted line is — ISBN, ISSN, NBN, barcode, catalog ID.",
    {
      version: "1.2.0",
      installedAt: "2026-02-04",
      triggers: ["OnDemand"],
      declares: {
        identifierTypes: ["NBN", "ISSN", "ISBN", "Barcode", "Catalog ID"],
        inputMode: "Text",
      },
      fields: ["checksums", "unknown"],
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
      declares: { identifierTypes: ["ISBN", "ISSN", "Barcode"], inputMode: "Camera" },
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
      declares: { identifierTypes: ["ISBN", "ISSN", "NBN"], inputMode: "Photo" },
      fields: ["engine", "lang", "match"],
    },
  ),
  implementation(
    "pt11",
    "PriorityFirst",
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
  implementation("pt21", "SamlIdentity", "Identity", "Logs in through a SAML federation.", {
    version: "1.3.0",
    installedAt: "2026-02-02",
    triggers: ["OnLogin"],
    declares: { loginEntry: "Redirect" },
    fields: ["metadata", "sp"],
  }),
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
      fields: ["signup", "password_min"],
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
  implementation("pt13", "SmtpMailer", "DeliveryChannel", "Sends mail through an SMTP server.", {
    version: "1.1.0",
    installedAt: "2026-01-15",
    triggers: ["OnEvent"],
    declares: { channelInterface: "Email" },
    fields: ["host", "port", "from", "tls"],
  }),
  implementation(
    "pt14",
    "MailgunMailer",
    "DeliveryChannel",
    "Sends mail through the Mailgun API — for volume the house server should not carry.",
    {
      version: "0.6.2",
      installedAt: "2026-05-02",
      triggers: ["OnEvent"],
      declares: { channelInterface: "Email" },
      fields: ["domain", "region", "from", "api_key*"],
    },
  ),
  implementation("pt15", "SlackNotifier", "DeliveryChannel", "Posts to a Slack channel as a bot.", {
    version: "1.0.3",
    installedAt: "2026-06-03",
    triggers: ["OnEvent"],
    declares: { channelInterface: "Chat" },
    fields: ["workspace", "bot", "token*"],
  }),
  implementation(
    "pt16",
    "TeamsNotifier",
    "DeliveryChannel",
    "Posts to a Microsoft Teams channel through a workflow webhook.",
    {
      version: "0.9.0",
      installedAt: "2026-06-22",
      triggers: ["OnEvent"],
      declares: { channelInterface: "Chat" },
      fields: ["tenant", "workflow"],
    },
  ),
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

const houseRuleExpression = [
  'if .document.type == "Periodical" then "Periodicals" else empty end',
  'if (.record.fields."260".c // "" | test("^18")) then "19th-century prints" else empty end',
  'if .request.project == "Moravica" then "Moravica" else empty end',
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
    name: "Default",
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
  instance({
    id: "pi25",
    name: "House rules",
    implementationId: "pt19",
    configuration: { expr: `[ ${houseRuleExpression.join(", ")} ]` },
    triggers: ["OnProposal"],
    settings: {
      kind: "Custody",
      custodyNames: ["Periodicals", "19th-century prints", "Moravica"],
    },
    createdAt: "2026-06-23",
    lastRunAt: june(25, 10, 20),
  }),
  instance({
    id: "pi11",
    name: "Default",
    implementationId: "pt8",
    configuration: { checksums: "on", unknown: "flag" },
    triggers: ["OnDemand"],
    createdAt: "2026-02-04",
    lastRunAt: june(25, 9, 40),
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
    id: "pi23",
    name: "eduID.cz",
    implementationId: "pt21",
    configuration: { metadata: "eduid.cz/metadata", sp: "vera.mzk.cz" },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with eduID",
      order: 2,
      userIdClaim: "eduPersonPrincipalName",
      defaultRoleId: "reader",
      matchByEmail: true,
      mappings: [],
    },
    createdAt: "2026-02-02",
    lastRunAt: june(18, 16, 2),
  }),
  instance({
    id: "pi24",
    name: "Local accounts",
    implementationId: "pt22",
    configuration: { signup: "off", password_min: "12" },
    triggers: ["OnLogin"],
    settings: {
      kind: "Identity",
      label: "Log in with a VERA account",
      order: 3,
      userIdClaim: "username",
      defaultRoleId: null,
      matchByEmail: false,
      mappings: [],
    },
    createdAt: "2026-01-15",
    lastRunAt: june(25, 8, 40),
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
    id: "pi19",
    name: "MZK Teams",
    implementationId: "pt16",
    configuration: { tenant: "mzk.cz", workflow: "vera-post" },
    triggers: ["OnEvent"],
    createdBy: "u2",
    createdAt: "2026-06-22",
    lastRunAt: june(22, 15, 30),
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
    id: "pi31",
    name: "Material type",
    implementationId: "pt28",
    configuration: { table: "periodical→c22, map→c4" },
    triggers: ["OnProposal"],
    settings: { kind: "Classifier", order: 2 },
    createdAt: "2026-10-07",
    lastRunAt: june(24, 15, 10),
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
