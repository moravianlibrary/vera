package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.LinkReader;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.catalog.ReadLinkAnswer;
import cz.mzk.vera.plugin.catalog.ReadLinkInput;
import cz.mzk.vera.plugin.catalog.SearchAnswer;
import cz.mzk.vera.plugin.catalog.SearchInput;
import cz.mzk.vera.plugin.catalog.SearchableCatalog;
import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.input.BarcodeReader;
import cz.mzk.vera.plugin.input.Input;
import cz.mzk.vera.plugin.input.ReadBarcodeInput;
import cz.mzk.vera.plugin.input.ReadBarcodeAnswer;
import cz.mzk.vera.plugin.input.PhotoReader;
import cz.mzk.vera.plugin.input.ReadPhotoInput;
import cz.mzk.vera.plugin.input.ReadPhotoAnswer;
import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import cz.mzk.vera.pluginhost.PluginOutcome.Answered;
import cz.mzk.vera.requests.RequestPlacements;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// BK3d; PLG-api-kinds; ACCESS-custody-by-plugins.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class PluginRecordCallsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private PluginCalls calls;

    @Autowired
    private TemplateResetService resetService;

    @Autowired
    private RequestPlacements requestPlacements;

    @Autowired
    private DSLContext dsl;

    @BeforeEach
    void resetSeed() {
        resetService.reset("base", true);
    }

    @Test
    void catalogReadAnswersRecord() {
        ReadAnswer read = answer(calls.call("pi1", CatalogAdapter.class, "read",
                (plugin, context) -> plugin.read(context, new ReadInput("MZK03-000112877"))),
                cz.mzk.vera.plugin.catalog.ReadAnswer.class);
        assertThat(read.fields().get("title")).isEqualTo("Kniha o Brně");
        assertThat(((Map<?, ?>) read.fields().get("shelfMarks")).get("ST3-0880")).isNull();
        assertThat(read.units()).isNull();
        assertThat(read.issuanceType()).isEqualTo("Monograph");
        assertThat(read.readAt()).isEqualTo(Instant.parse("2026-06-25T08:40:00Z"));
    }

    @Test
    void catalogReadRefusesUnknownIdAsNotFound() {
        PluginOutcome<ReadAnswer> refused = calls.call("pi1", CatalogAdapter.class, "read",
                (plugin, context) -> plugin.read(context, new ReadInput("MZK03-000000000")));
        assertThat(refused).isEqualTo(new PluginOutcome.Refused<>("not_found", "not_found"));
    }

    @Test
    void catalogLinkReaderAnswersLink() {
        ReadLinkAnswer answer = answer(calls.call("pi1", CatalogAdapter.class, "readLink",
                (plugin, context) -> ((LinkReader) plugin).readLink(context,
                        new ReadLinkInput("https://aleph.mzk.cz/F?func=find-b&doc_number=000556300&base=MZK03"))),
                cz.mzk.vera.plugin.catalog.ReadLinkAnswer.class);
        assertThat(answer.catalogId()).isEqualTo("MZK03-000556300");
    }

    @Test
    void catalogLinkReaderRefusesMalformedLink() {
        PluginOutcome<ReadLinkAnswer> refused = calls.call("pi1", CatalogAdapter.class, "readLink",
                (plugin, context) -> ((LinkReader) plugin).readLink(context, new ReadLinkInput("no record id here")));
        assertThat(refused).isEqualTo(new PluginOutcome.Refused<>("malformed", "malformed"));
    }

    @Test
    void catalogSearchStaysWithinItsBase() {
        SearchAnswer answer = answer(calls.call("pi1", CatalogAdapter.class, "search",
                (plugin, context) -> ((SearchableCatalog) plugin).search(context, new SearchInput("Morav"))),
                cz.mzk.vera.plugin.catalog.SearchAnswer.class);
        assertThat(answer.hits()).extracting("catalogId").contains("MZK03-000778120")
                .doesNotContain("VKOL01-000456123", "NKC01-002345678");
    }

    @Test
    void barcodeReadsAdvanceOnlyForNonEmptyPhotos() {
        ReadBarcodeAnswer first = answer(calls.call("pi12", Input.class, "readBarcode",
                (plugin, context) -> ((BarcodeReader) plugin).readBarcode(context,
                        new ReadBarcodeInput("photo one"))),
                cz.mzk.vera.plugin.input.ReadBarcodeAnswer.class);
        ReadBarcodeAnswer empty = answer(calls.call("pi12", Input.class, "readBarcode",
                (plugin, context) -> ((BarcodeReader) plugin).readBarcode(context, new ReadBarcodeInput(""))),
                cz.mzk.vera.plugin.input.ReadBarcodeAnswer.class);
        ReadBarcodeAnswer second = answer(calls.call("pi12", Input.class, "readBarcode",
                (plugin, context) -> ((BarcodeReader) plugin).readBarcode(context,
                        new ReadBarcodeInput("photo two"))),
                cz.mzk.vera.plugin.input.ReadBarcodeAnswer.class);
        assertThat(first.value()).isEqualTo("MZK-2801-000533");
        assertThat(empty.value()).isNull();
        assertThat(second.value()).isEqualTo("MZK-2801-000341");
    }

    @Test
    void photoReaderReturnsSampleAndBothCandidates() {
        ReadPhotoAnswer answer = answer(calls.call("pi13", Input.class, "readPhoto",
                (plugin, context) -> ((PhotoReader) plugin).readPhoto(context, new ReadPhotoInput("image"))),
                cz.mzk.vera.plugin.input.ReadPhotoAnswer.class);
        assertThat(answer.seen()).isEqualTo("a catalog card");
        assertThat(answer.values()).hasSize(4).first().satisfies(value -> {
            assertThat(value.label()).isEqualTo("Author");
            assertThat(value.value()).isEqualTo("Kratochvíl, Josef");
            assertThat(value.confidence()).isEqualTo(0.94);
        });
        assertThat(answer.candidates()).extracting("catalogId")
                .containsExactly("MZK03-000778120", "MZK03-000112877");
    }

    @Test
    void custodyAnswersSeededPlacements() {
        Document document = new Document("D20", "MZK01-001622010",
                new Document.Unit("volume-name", "1889"), "Národní listy", "Periodical", "ST1-0901");
        Request request = new Request("R16", "D20", "u6", Instant.parse("2026-06-22T09:00:00Z"),
                "Needed for a seminar in October.", "B-0038", null,
                Instant.parse("2026-06-22T09:00:00Z"), "Pending");
        PlaceAnswer placed = answer(calls.call("pi25", Custody.class, "place",
                (plugin, context) -> plugin.place(context, new PlaceInput(request, document))),
                cz.mzk.vera.plugin.custody.PlaceAnswer.class);
        assertThat(placed.custodies()).containsExactly("pc1", "pc2");
    }

    @Test
    void custodyAppliesPeriodicalRuleWithoutSeededPlacement() {
        Document document = new Document("D20", "MZK01-001622010",
                new Document.Unit("volume-name", "1889"), "Národní listy", "Periodical", "ST1-0901");
        Request request = new Request("new-request", "D20", "u6", Instant.parse("2026-06-22T09:00:00Z"),
                null, "B-0038", null, Instant.parse("2026-06-22T09:00:00Z"), "Pending");
        PlaceAnswer fallback = answer(calls.call("pi25", Custody.class, "place",
                (plugin, context) -> plugin.place(context, new PlaceInput(request, document))),
                cz.mzk.vera.plugin.custody.PlaceAnswer.class);
        assertThat(fallback.custodies()).containsExactly("pc1");
    }

    @Test
    void classifierSuggestsRegionalPlaceForPeriodical() {
        Request request = new Request("new-request", "D20", "u6", Instant.parse("2026-06-22T09:00:00Z"),
                null, "B-0038", null, Instant.parse("2026-06-22T09:00:00Z"), "Pending");
        Document periodical = new Document("D20", "MZK01-001622010", null,
                "Brno regional gazette", "Periodical", null);
        Optional<Suggestion> regional = suggestion("pi30", request, periodical);
        assertThat(regional).contains(new Suggestion(new Category("c21", "Regional", "c2"),
                "Periodical, Moravian place of publication"));
    }

    @Test
    void classifierSuggestsMaterialLeafForMap() {
        Request request = new Request("new-request", "D20", "u6", Instant.parse("2026-06-22T09:00:00Z"),
                null, "B-0038", null, Instant.parse("2026-06-22T09:00:00Z"), "Pending");
        Document map = new Document("D-map", "", null, "Map", "Map", null);
        assertThat(suggestion("pi31", request, map)).contains(new Suggestion(new Category("c4", "Maps", null),
                "Map"));
    }

    @Test
    void classifierHasNoSuggestionForMonograph() {
        Request request = new Request("new-request", "D20", "u6", Instant.parse("2026-06-22T09:00:00Z"),
                null, "B-0038", null, Instant.parse("2026-06-22T09:00:00Z"), "Pending");
        Document monograph = new Document("D-book", "", null, "Book", "Monograph", null);
        assertThat(suggestion("pi31", request, monograph)).isEmpty();
    }

    @Test
    void seededPlacementR16HasCustodies() {
        assertThat(placements("R16")).containsExactly("pc1", "pc2");
    }

    @Test
    void seededPlacementR35HasNoCustodies() {
        assertThat(placements("R35")).isEmpty();
    }

    @Test
    void seededPlacementCountIs57() {
        assertThat(dsl.fetchCount(REQUEST_PLACEMENTS)).isEqualTo(57);
    }

    @Test
    void placingTwiceKeepsPlacementRowsOnce() {
        requestPlacements.place(dsl, "R16");
        List<String> first = placements("R16");
        requestPlacements.place(dsl, "R16");
        assertThat(placements("R16")).isEqualTo(first);
    }

    private Optional<Suggestion> suggestion(String id, Request request, Document document) {
        PluginOutcome<Optional<Suggestion>> outcome = calls.call(id, Classifier.class, "suggest",
                (plugin, context) -> plugin.suggest(context, new SuggestInput(request, document)));
        assertThat(outcome).isInstanceOf(Answered.class);
        return ((Optional<?>) ((Answered<?>) outcome).answer()).map(Suggestion.class::cast);
    }

    private List<String> placements(String requestId) {
        return dsl.select(REQUEST_PLACEMENTS.CUSTODY_ID)
                .from(REQUEST_PLACEMENTS)
                .where(REQUEST_PLACEMENTS.REQUEST_ID.eq(requestId))
                .orderBy(REQUEST_PLACEMENTS.POSITION)
                .fetch(REQUEST_PLACEMENTS.CUSTODY_ID);
    }

    private <A> A answer(PluginOutcome<A> outcome, Class<A> type) {
        assertThat(outcome).isInstanceOf(Answered.class);
        Object value = ((Answered<?>) outcome).answer();
        return type.cast(value);
    }
}
