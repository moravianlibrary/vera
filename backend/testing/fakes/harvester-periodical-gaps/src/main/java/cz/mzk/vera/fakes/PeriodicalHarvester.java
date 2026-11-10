package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.harvester.HarvestAnswer;
import cz.mzk.vera.plugin.harvester.HarvestInput;
import cz.mzk.vera.plugin.harvester.Harvester;

// PLG-api-kinds: Harvester.
public final class PeriodicalHarvester implements Harvester {
    private final HarvestFake delegate = new HarvestFake();
    @Override public HarvestAnswer harvest(PluginContext context, HarvestInput input) {
        return delegate.harvest(context, input);
    }
}
