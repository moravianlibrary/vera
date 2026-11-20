package cz.mzk.vera.plugin.identity;

import java.util.Map;

// PLG-api-kinds: Identity.
public sealed interface CompleteInput permits CompleteInput.Callback, CompleteInput.Form {
    record Callback(Map<String, String> parameters, Map<String, String> flowData, String callback,
            String userIdClaim) implements CompleteInput {}

    record Form(String username, String password, String userIdClaim) implements CompleteInput {}
}
