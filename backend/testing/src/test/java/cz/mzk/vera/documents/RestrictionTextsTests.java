package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// STAT-public: a Restriction finding may give askers' text per language; one that gives none
// keeps what the same rule gave, and a new rule without any leaves VERA's own wording.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class RestrictionTextsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private TemplateResetService resetService;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private PluginAnswerWrites writes;
    @Autowired
    private JsonMapper json;

    @BeforeEach
    void reset() {
        resetService.reset("base", true);
    }

    @Test
    void askersReadTheFindingsTextInEachLanguageItGives() {
        write(new RestrictionCheckAnswer.Finding("Conservation hold", true, null, "Still unstable.",
                Map.of("cs", " Stále nelze. ", "en", "Still not possible.", "de", "Nicht.")));
        JsonNode stored = publicText();
        assertThat(stored.path("cs").asString()).isEqualTo("Stále nelze.");
        assertThat(stored.path("en").asString()).isEqualTo("Still not possible.");
        assertThat(stored.has("de")).isFalse();

        write(new RestrictionCheckAnswer.Finding("Conservation hold", true, null, "Still unstable."));
        assertThat(publicText().path("cs").asString()).isEqualTo("Stále nelze.");

        write(new RestrictionCheckAnswer.Finding("Copyright", true, null, "Protected until 2031."));
        assertThat(publicText()).isNull();
    }

    private void write(RestrictionCheckAnswer.Finding finding) {
        dsl.transaction(configuration -> writes.restriction(configuration.dsl(), "IT6", "pi28", "Copyright rule",
                new RestrictionCheckAnswer(List.of(finding)), null));
    }

    private JsonNode publicText() {
        JSONB stored = dsl.select(ITERATIONS.RESTRICTION_PUBLIC_TEXT).from(ITERATIONS)
                .where(ITERATIONS.ID.eq("IT6")).fetchOne(ITERATIONS.RESTRICTION_PUBLIC_TEXT);
        return stored == null ? null : json.readTree(stored.data());
    }
}
