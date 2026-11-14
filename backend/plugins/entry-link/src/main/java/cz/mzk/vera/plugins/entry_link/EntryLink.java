package cz.mzk.vera.plugins.entry_link;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.input.EntryLinkInput;
import cz.mzk.vera.plugin.input.Input;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;

// PLG-api-entry; ACT-entry-link.
public final class EntryLink implements Input, EntryLinkInput {
    @Override
    public EntryAnswer entry(PluginContext context, EntryInput input) {
        Map<String, String> parameters = input.parameters();
        String parameterName = nonblank(context.configuration().get("record_parameter"));
        String record = parameterName == null ? null : nonblank(parameters.get(parameterName));
        if (record == null) {
            record = nonblank(parameters.get("record"));
        }

        Item item = null;
        if (record != null) {
            item = new CatalogId(record);
        } else {
            String identifier = nonblank(parameters.get("identifier"));
            String type = nonblank(parameters.get("type"));
            if (identifier != null && type != null) {
                item = new Identifier(type, identifier);
            }
        }

        return new EntryAnswer(item, nonblank(parameters.get("unit")),
                reasonOf(parameters.get("reason")), originOf(input.page()));
    }

    private String originOf(String page) {
        if (page == null || page.isBlank()) {
            return null;
        }
        try {
            URI uri = new URI(page);
            if (uri.getScheme() == null || uri.getRawAuthority() == null) {
                return null;
            }
            return uri.getScheme() + "://" + uri.getRawAuthority();
        } catch (URISyntaxException exception) {
            return null;
        }
    }

    private String nonblank(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String reasonOf(String reason) {
        String value = nonblank(reason);
        if (value != null && value.length() > 500) {
            return value.substring(0, 500);
        }
        return value;
    }
}
