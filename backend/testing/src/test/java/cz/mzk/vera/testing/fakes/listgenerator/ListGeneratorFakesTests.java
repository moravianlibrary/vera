package cz.mzk.vera.testing.fakes.listgenerator;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.listgenerator.ListGenerator;
import cz.mzk.vera.plugin.listgenerator.ShortfallCause;
import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// PLG-api-kinds: List generator; PLAN-generate.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class ListGeneratorFakesTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private PluginCalls calls;

    @Autowired
    private TemplateResetService resetService;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void resetSeed() {
        resetService.reset("base", true);
    }

    @Test
    void noMixBudgetFillsAndLeavesSlack() throws IOException {
        assertCase("no-mix-slack");
    }

    @Test
    void mixFillsEveryLeaf() throws IOException {
        assertCase("mix-filled");
    }

    @Test
    void shortLeafRerespreadsNearestFirstWithCoversReason() throws IOException {
        assertCase("short-leaf-rerespread");
    }

    @Test
    void topCategoryCanLeaveALeafOut() throws IOException {
        assertCase("top-category-left-out");
    }

    @Test
    void correctingAllocationStaysShort() throws IOException {
        assertCase("correction-stays-short");
    }

    @Test
    void currentMembersCountTowardTheirGoal() throws IOException {
        assertCase("members-count-toward-goal");
    }

    @Test
    void tenPercentToleranceIsReadFromConfiguration() throws IOException {
        jdbc.update("UPDATE plugin_instances SET configuration=?::jsonb WHERE id='pi14'",
                "{\"tolerance\":\"10%\",\"order\":\"priority,asked\"}");
        assertCase("tolerance-ten-percent");
    }

    @Test
    void advisorUsesSeedReason() throws IOException {
        assertCase("advisor-with-reason");
    }

    @Test
    void advisorUsesFallbackWithoutSeedReason() throws IOException {
        assertCase("advisor-without-reason");
    }

    @Test
    void bothBaseGeneratorInstancesAreEnabledAndLoadable() {
        assertThat(jdbc.queryForObject("SELECT is_enabled FROM plugin_instances WHERE id='pi14'",
                Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("SELECT is_enabled FROM plugin_instances WHERE id='pi15'",
                Boolean.class)).isTrue();
        GenerateAnswer priority = answer(calls.call("pi14", ListGenerator.class, "generate",
                (plugin, context) -> plugin.generate(context, emptyInput())));
        GenerateAnswer advisor = answer(calls.call("pi15", ListGenerator.class, "generate",
                (plugin, context) -> plugin.generate(context, emptyInput())));
        assertThat(priority).isNotNull();
        assertThat(advisor).isNotNull();
    }

    private void assertCase(String name) throws IOException {
        JsonNode root;
        try (InputStream stream = getClass().getClassLoader()
                .getResourceAsStream("list-generator/" + name + ".json")) {
            if (stream == null) {
                throw new IOException("Missing generator case " + name);
            }
            root = mapper.readTree(stream);
        }
        GenerateInput input = input(root.path("input"));
        boolean advisor = root.path("isAdvisor").asBoolean();
        String instance = advisor ? "pi15" : "pi14";
        GenerateAnswer expected = answer(root.path("answer"));
        GenerateAnswer actual = answer(calls.call(instance, ListGenerator.class, "generate",
                (plugin, context) -> plugin.generate(context, input)));
        assertThat(actual).isEqualTo(expected);
    }

    private GenerateInput input(JsonNode value) {
        List<GenerateInput.Leaf> leaves = new ArrayList<>();
        for (JsonNode leaf : value.path("leaves")) {
            Category category = new Category(leaf.path("id").asString(), leaf.path("name").asString(),
                    nullable(leaf.path("parentId")));
            leaves.add(new GenerateInput.Leaf(category, leaf.path("topCategoryId").asString(),
                    leaf.path("share").isNull() ? null : leaf.path("share").asDouble(), nullable(leaf.path("nodeId"))));
        }
        List<GenerateInput.Node> nodes = new ArrayList<>();
        for (JsonNode node : value.path("nodes")) {
            nodes.add(new GenerateInput.Node(node.path("id").asString(),
                    node.path("share").isNull() ? null : node.path("share").asDouble()));
        }
        List<GenerateInput.PoolItem> pool = new ArrayList<>();
        for (JsonNode item : value.path("pool")) {
            pool.add(new GenerateInput.PoolItem(iteration(item.path("iteration")), item.path("pages").asInt(),
                    item.path("askedAt").asString()));
        }
        List<GenerateInput.Member> members = new ArrayList<>();
        for (JsonNode item : value.path("members")) {
            members.add(new GenerateInput.Member(iteration(item.path("iteration")), item.path("pages").asInt()));
        }
        Map<String, Integer> allocation = allocation(value.path("allocation"));
        List<String> topIds = new ArrayList<>();
        value.path("topCategoryIds").forEach(item -> topIds.add(item.asString()));
        return new GenerateInput(new GenerateInput.ShapingIntention(value.path("intention").path("id").asString(),
                value.path("intention").path("name").asString()), value.path("hasMix").asBoolean(), leaves,
                nodes, pool, members, value.path("pages").asInt(), topIds, allocation);
    }

    private Map<String, Integer> allocation(JsonNode value) {
        if (value.isNull()) {
            return null;
        }
        Map<String, Integer> allocation = new HashMap<>();
        value.properties().forEach(entry -> allocation.put(entry.getKey(), entry.getValue().asInt()));
        return allocation;
    }

    private Iteration iteration(JsonNode value) {
        return new Iteration(value.path("id").asString(), "D1", 1, "R1",
                value.path("categoryId").asString(), value.path("priority").asString(), null,
                "Ready", null, null);
    }

    private GenerateAnswer answer(JsonNode value) {
        List<GenerateAnswer.Pick> picks = new ArrayList<>();
        for (JsonNode pick : value.path("picks")) {
            picks.add(new GenerateAnswer.Pick(pick.path("iterationId").asString(), pick.path("why").asString()));
        }
        List<GenerateAnswer.Shortfall> shortfalls = new ArrayList<>();
        for (JsonNode shortfall : value.path("shortfalls")) {
            String cause = shortfall.path("cause").asString();
            shortfalls.add(new GenerateAnswer.Shortfall(shortfall.path("categoryId").asString(),
                    shortfall.path("pages").asInt(), switch (cause) {
                        case "leftOut" -> ShortfallCause.LEFT_OUT;
                        case "overshoot" -> ShortfallCause.OVERSHOOT;
                        case "noSupply" -> ShortfallCause.NO_SUPPLY;
                        default -> ShortfallCause.UNALLOCATED;
                    }));
        }
        return new GenerateAnswer(picks, value.path("spreadCount").asInt(), shortfalls);
    }

    private GenerateInput emptyInput() {
        return new GenerateInput(new GenerateInput.ShapingIntention("I1", "Empty"), false,
                List.of(), List.of(), List.of(), List.of(), 0, List.of(), null);
    }

    private String nullable(JsonNode value) {
        return value.isNull() ? null : value.asString();
    }

    @SuppressWarnings("unchecked")
    private <A> A answer(PluginOutcome<A> outcome) {
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
        return (A) ((PluginOutcome.Answered<?>) outcome).answer();
    }
}
