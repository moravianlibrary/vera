package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.listgenerator.ListGenerator;

// PLAN-generate; PLG-api-kinds: List generator.
public final class PriorityFirst implements ListGenerator {
    @Override
    public GenerateAnswer generate(PluginContext context, GenerateInput input) {
        return GeneratorAlgorithm.generate(context, input, false);
    }
}
