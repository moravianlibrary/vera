package cz.mzk.vera.plugins.aleph_oai_catalog_adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.catalog.CatalogAdapterRefused;
import cz.mzk.vera.plugin.catalog.ChangesInput;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.catalog.ReadLinkInput;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AlephOaiCatalogAdapterTests {
    private final AlephOaiCatalogAdapter adapter = new AlephOaiCatalogAdapter();
    private final Path recorded = Path.of(System.getProperty("vera.recorded.dir"));

    @Test
    void readsEveryRecordedRecordAndMatchesHandCountedUnits() throws Exception {
        List<String> ids = Files.readAllLines(recorded.resolve("records.psv")).stream()
                .filter(line -> !line.isBlank() && !line.startsWith("#"))
                .map(line -> line.split("\\|", -1)[0]).toList();
        FakeHttp http = new FakeHttp(recorded, null);
        TestContext context = context(http);
        for (String id : ids) {
            var answer = adapter.read(context, new ReadInput(id));
            assertThat(answer.catalogId()).isEqualTo(id);
            assertThat(answer.fields().get("title")).as(id).isNotNull();
            assertThat(answer.fields().get("shelfMarks")).isInstanceOf(Map.class);
            assertThat(answer.fields().get("barcodes")).isInstanceOf(Map.class);
            var xml = Files.readString(recorded.resolve("aleph").resolve(id + ".xml"));
            int volumeCount = distinctSubfieldValues(xml, "v");
            int barcodeCount = distinctSubfieldValues(xml, "b");
            if (volumeCount == 0) assertThat(answer.units()).as(id + " no volumes").isNull();
            else assertThat(answer.units()).as(id + " unit volumes").hasSize(volumeCount);
            assertThat(((Map<?, ?>) answer.fields().get("barcodes")).size()).as(id + " barcodes").isEqualTo(barcodeCount);
        }
        try (var input = getClass().getResourceAsStream("/unit-counts.psv")) {
            for (String line : new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).lines().toList()) {
                if (!line.isBlank() && !line.startsWith("#")) {
                    String[] expected = line.split("\\|", -1);
                    var answer = adapter.read(context, new ReadInput(expected[0]));
                    if (Integer.parseInt(expected[1]) == 0) assertThat(answer.units()).as(expected[0]).isNull();
                    else assertThat(answer.units()).as(expected[0] + " distinct volumes").hasSize(Integer.parseInt(expected[1]));
                    assertThat(((Map<?, ?>) answer.fields().get("barcodes")).size()).as(expected[0] + " barcodes")
                            .isEqualTo(Integer.parseInt(expected[2]));
                }
            }
        }
        assertThat(adapter.read(context, new ReadInput("MZK01-000302102")).fields()).doesNotContainKey("pageCount");
    }

    @Test
    void mapsNotFoundUnavailableAndMalformedResponses() {
        assertThatThrownBy(() -> adapter.read(context(new FakeHttp(recorded, "not-found")), new ReadInput("MZK01-999999999")))
                .isInstanceOf(CatalogAdapterRefused.class).hasMessage("not_found");
        assertThatThrownBy(() -> adapter.read(context(new FakeHttp(recorded, "503")), new ReadInput("MZK01-000001790")))
                .isInstanceOf(PluginUnavailable.class);
        assertThatThrownBy(() -> adapter.read(context(new FakeHttp(recorded, "truncated")), new ReadInput("MZK01-000001790")))
                .isInstanceOf(CatalogAdapterRefused.class).hasMessage("Malformed OAI-PMH response");
    }

    @Test
    void recognizesPastedLinksAndBareIds() {
        TestContext context = context(new FakeHttp(recorded, null));
        assertThat(adapter.readLink(context, new ReadLinkInput("https://vufind.mzk.cz/Record/MZK01-000067431")).catalogId()).isEqualTo("MZK01-000067431");
        assertThat(adapter.readLink(context, new ReadLinkInput("https://aleph.mzk.cz/F?func=find-b&doc_number=000067431&base=MZK01")).catalogId()).isEqualTo("MZK01-000067431");
        assertThat(adapter.readLink(context, new ReadLinkInput("MZK01-000067431")).catalogId()).isEqualTo("MZK01-000067431");
        assertThat(adapter.readLink(context, new ReadLinkInput("000067431")).catalogId()).isEqualTo("MZK01-000067431");
        assertThatThrownBy(() -> adapter.readLink(context, new ReadLinkInput("not a record"))).isInstanceOf(CatalogAdapterRefused.class);
    }

    @Test
    void followsResumptionTokenAndReturnsNewestDatestamp() {
        FakeHttp http = new FakeHttp(recorded, null);
        http.pages = List.of(oaiPage("<header><identifier>oai:aleph.mzk.cz:MZK01-000000001</identifier><datestamp>2026-01-01</datestamp></header>", "next"),
                oaiPage("<header status=\"deleted\"><identifier>oai:aleph.mzk.cz:MZK01-000000002</identifier><datestamp>2026-02-01</datestamp></header>", ""));
        var result = adapter.changes(context(http), new ChangesInput("2025-12-01"));
        assertThat(result.catalogIds()).containsExactly("MZK01-000000001", "MZK01-000000002");
        assertThat(result.nextCursor()).isEqualTo("2026-02-01");
    }

    @Test
    void readHasTheFakeRecordFieldNamesAndKinds() {
        var answer = adapter.read(context(new FakeHttp(recorded, null)), new ReadInput("MZK01-000067431"));
        assertThat(answer.fields()).containsKeys("title", "identifiers", "shelfMarks", "barcodes");
        assertThat(answer.fields().get("title")).isInstanceOf(String.class);
        assertThat(answer.fields().get("identifiers")).isInstanceOf(List.class);
        assertThat(answer.fields().get("shelfMarks")).isInstanceOf(Map.class);
        assertThat(answer.fields().get("barcodes")).isInstanceOf(Map.class);
    }

    private int distinctSubfieldValues(String xml, String code) throws Exception {
        var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        var document = factory.newDocumentBuilder().parse(new org.xml.sax.InputSource(new java.io.StringReader(xml)));
        var fields = document.getElementsByTagNameNS("http://www.loc.gov/MARC21/slim", "datafield");
        java.util.Set<String> values = new java.util.HashSet<>();
        for (int i = 0; i < fields.getLength(); i++) {
            var field = (org.w3c.dom.Element) fields.item(i);
            if (!"996".equals(field.getAttribute("tag"))) continue;
            var subs = field.getElementsByTagNameNS("http://www.loc.gov/MARC21/slim", "subfield");
            for (int j = 0; j < subs.getLength(); j++) {
                var sub = (org.w3c.dom.Element) subs.item(j);
                if (code.equals(sub.getAttribute("code")) && !sub.getTextContent().isBlank()) {
                    values.add(sub.getTextContent().trim());
                }
            }
        }
        return values.size();
    }

    private String oaiPage(String headers, String token) {
        return "<OAI-PMH xmlns=\"http://www.openarchives.org/OAI/2.0/\"><ListIdentifiers>" + headers
                + "<resumptionToken>" + token + "</resumptionToken></ListIdentifiers></OAI-PMH>";
    }

    private TestContext context(FakeHttp http) { return new TestContext(http); }

    private static final class TestContext implements PluginContext {
        private final PluginHttp http;
        TestContext(PluginHttp http) { this.http = http; }
        public String instanceId() { return "test"; }
        public Map<String, String> configuration() { return Map.of("oai_url", "https://aleph.mzk.cz/OAI", "base", "MZK01", "opac_url", "https://vufind.mzk.cz/Record/"); }
        public Map<String, String> secrets() { return Map.of(); }
        public PluginHttp http() { return http; }
        public System.Logger logger() { return System.getLogger("test"); }
        public Clock clock() { return Clock.fixed(Instant.parse("2026-11-20T12:00:00Z"), ZoneOffset.UTC); }
        public cz.mzk.vera.plugin.LocalPasswords localPasswords() { throw new UnsupportedOperationException(); }
    }

    private static final class FakeHttp implements PluginHttp {
        private final Path recorded;
        private final String fault;
        List<String> pages;
        int page;
        FakeHttp(Path recorded, String fault) { this.recorded = recorded; this.fault = fault; }
        public Response send(Request request) {
            if ("503".equals(fault)) return new Response(503, Map.of(), new byte[0]);
            if ("truncated".equals(fault)) return response("<OAI-PMH>");
            String query = request.uri().getQuery();
            if (query != null && query.contains("ListIdentifiers")) {
                if (pages != null) return response(pages.get(page++));
                return response(oai("<error code=\"noRecordsMatch\">none</error>"));
            }
            if ("not-found".equals(fault)) return response(oai("<error code=\"idDoesNotExist\">missing</error>"));
            String identifier = java.util.Arrays.stream(query.split("&"))
                    .map(part -> part.split("=", 2))
                    .filter(parts -> parts.length == 2 && parts[0].equals("identifier"))
                    .map(parts -> java.net.URLDecoder.decode(parts[1], java.nio.charset.StandardCharsets.UTF_8))
                    .findFirst().orElse("");
            String id = identifier.substring("oai:aleph.mzk.cz:".length());
            try { return response(Files.readString(recorded.resolve("aleph").resolve(id + ".xml"))); }
            catch (Exception e) { return response(oai("<error code=\"idDoesNotExist\">missing</error>")); }
        }
        private Response response(String body) { return new Response(200, Map.of(), body.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
        private String oai(String body) { return "<OAI-PMH xmlns=\"http://www.openarchives.org/OAI/2.0/\">" + body + "</OAI-PMH>"; }
    }
}
