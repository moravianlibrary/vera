package cz.mzk.vera.plugin.input;

import cz.mzk.vera.plugin.PluginContext;
import java.util.List;

// PLG-api-kinds: Input.
public interface PhotoReader {
    ReadPhotoAnswer readPhoto(PluginContext context, ReadPhotoInput input);
}
