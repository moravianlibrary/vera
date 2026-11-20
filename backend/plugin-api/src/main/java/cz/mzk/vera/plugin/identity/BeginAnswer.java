package cz.mzk.vera.plugin.identity;

import java.util.Map;

// PLG-api-kinds: Identity.
public record BeginAnswer(String redirect, Map<String, String> flowData) {}
