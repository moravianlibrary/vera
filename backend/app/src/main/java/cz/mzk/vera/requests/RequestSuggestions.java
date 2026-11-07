package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;
import static org.jooq.impl.DSL.notExists;

import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.Optional;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

// PLG-api-kinds; VIEW-requests: persist the first enabled classifier's leaf suggestion after checking.
@Component
public class RequestSuggestions {
    private static final Logger LOGGER = LoggerFactory.getLogger(RequestSuggestions.class);

    private final PluginInstances instances;
    private final PluginCalls calls;

    public RequestSuggestions(PluginInstances instances, PluginCalls calls) {
        this.instances = instances;
        this.calls = calls;
    }

    public void suggest(DSLContext dsl, String requestId) {
        dsl.deleteFrom(REQUEST_SUGGESTIONS)
                .where(REQUEST_SUGGESTIONS.REQUEST_ID.eq(requestId)).execute();
        RequestPluginInput input = RequestPluginInput.read(dsl, requestId);
        if (input.request().checkedAt() == null) {
            return;
        }
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Classifier")) {
            PluginOutcome<Optional<Suggestion>> outcome = calls.call(dsl, instance.id(), Classifier.class,
                    "suggest", (plugin, context) -> plugin.suggest(context,
                            new SuggestInput(input.request(), input.document())));
            if (outcome instanceof PluginOutcome.Answered<Optional<Suggestion>> answered) {
                Optional<Suggestion> suggestion = answered.answer();
                if (suggestion.isEmpty() || !isLeaf(dsl, suggestion.get().category().id())) {
                    continue;
                }
                dsl.insertInto(REQUEST_SUGGESTIONS)
                        .set(REQUEST_SUGGESTIONS.REQUEST_ID, requestId)
                        .set(REQUEST_SUGGESTIONS.CATEGORY_ID, suggestion.get().category().id())
                        .set(REQUEST_SUGGESTIONS.REASON, suggestion.get().why())
                        .set(REQUEST_SUGGESTIONS.CLASSIFIER_ID, instance.id())
                        .execute();
                return;
            }
            LOGGER.warn("Classifier did not suggest instance={} request={} outcome={}",
                    instance.id(), requestId, outcome.getClass().getSimpleName());
        }
    }

    private boolean isLeaf(DSLContext dsl, String categoryId) {
        return dsl.select(CATEGORIES.ID).from(CATEGORIES)
                .where(CATEGORIES.ID.eq(categoryId))
                .and(notExists(dsl.selectOne().from(CATEGORIES)
                        .where(CATEGORIES.PARENT_ID.eq(categoryId)))
                )
                .fetchOne() != null;
    }
}
