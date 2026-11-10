package cz.mzk.vera.plugin.publicationdetector;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Publication detector.
public interface PublicationDetector {
    DetectAnswer detect(PluginContext context, DetectInput input);
}
