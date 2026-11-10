package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.publicationdetector.DetectAnswer;
import cz.mzk.vera.plugin.publicationdetector.DetectInput;
import cz.mzk.vera.plugin.publicationdetector.PublicationDetector;
import cz.mzk.vera.plugin.records.Iteration;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

// PLG-api-kinds: Publication detector; mock links.ts detectPublications and canonicalLinkOf.
public final class DetectorFake implements PublicationDetector {
    @Override
    public DetectAnswer detect(PluginContext context, DetectInput input) {
        Map<String, List<String>> fields = Wire.fields();
        for (Iteration iteration : input.iterations()) {
            Wire.put(fields, "iterationId", iteration.id());
            Wire.put(fields, "progress", iteration.progress());
            iteration.links().forEach(link -> {
                Wire.put(fields, "heldLinkId", iteration.id());
                Wire.put(fields, "heldLink", link.url());
            });
        }
        Map<String, List<String>> answer = Wire.send(context, "detectPublications", fields);
        List<DetectAnswer.FoundLink> links = new ArrayList<>();
        List<String> ids = Wire.all(answer, "iterationId");
        List<String> urls = Wire.all(answer, "url");
        for (int i = 0; i < ids.size(); i++) {
            links.add(new DetectAnswer.FoundLink(ids.get(i), urls.get(i)));
        }
        return new DetectAnswer(List.copyOf(links));
    }
}
