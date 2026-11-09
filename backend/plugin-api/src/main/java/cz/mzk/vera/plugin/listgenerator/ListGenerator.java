package cz.mzk.vera.plugin.listgenerator;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: List generator.
public interface ListGenerator {
    GenerateAnswer generate(PluginContext context, GenerateInput input);
}
