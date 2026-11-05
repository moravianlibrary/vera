package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.input.Input;
import cz.mzk.vera.plugin.input.PhotoReader;
import cz.mzk.vera.plugin.input.ReadPhotoAnswer;
import cz.mzk.vera.plugin.input.ReadPhotoInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// BK3d; PLG-api-kinds: Input.
public final class CoverRecognition implements Input, PhotoReader {
    @Override
    public ReadPhotoAnswer readPhoto(PluginContext context, ReadPhotoInput input) {
        Map<String, List<String>> answer = Wire.send(context, "readPhoto", Wire.fields());
        List<ReadPhotoAnswer.Value> values = new ArrayList<>();
        for (String value : Wire.all(answer, "value")) {
            String[] parts = value.split("\\u001f", -1);
            values.add(new ReadPhotoAnswer.Value(parts[0], parts[1], Double.parseDouble(parts[2])));
        }
        List<ReadPhotoAnswer.Candidate> candidates = new ArrayList<>();
        for (String candidate : Wire.all(answer, "candidate")) {
            String[] parts = candidate.split("\\u001f", -1);
            candidates.add(new ReadPhotoAnswer.Candidate(parts[0], parts[1], parts[2]));
        }
        return new ReadPhotoAnswer(Wire.first(answer, "seen"), List.copyOf(values), List.copyOf(candidates));
    }
}
