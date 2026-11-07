package cz.mzk.vera.plugin.validation;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Validation.
public interface Validation {
    ValidationCheckAnswer check(PluginContext context, ValidationCheckInput input);
}
