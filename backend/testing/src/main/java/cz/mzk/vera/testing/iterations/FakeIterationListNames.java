package cz.mzk.vera.testing.iterations;

import cz.mzk.vera.iterations.IterationListNames;
import cz.mzk.vera.testing.seeds.SeedReader;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// ACT-cancel: use the seed's list label in event data before the list module is built.
@Component
@Profile("test")
public class FakeIterationListNames implements IterationListNames {
    private final SeedReader seeds;

    public FakeIterationListNames(SeedReader seeds) {
        this.seeds = seeds;
    }

    @Override
    public String nameOf(String listId) {
        for (JsonNode list : seeds.read("base").path("collections").path("lists")) {
            if (listId.equals(list.path("id").asString())) {
                return list.path("name").asString();
            }
        }
        return listId;
    }
}
