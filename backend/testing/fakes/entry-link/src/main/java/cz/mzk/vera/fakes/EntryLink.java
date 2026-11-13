package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.input.EntryLinkInput;
import cz.mzk.vera.plugin.input.Input;

// PLG-api-entry: the Tlačítko digitalizovat fixture reads its own sysno field.
public final class EntryLink implements Input, EntryLinkInput {
    @Override
    public EntryAnswer entry(PluginContext context, EntryInput input) {
        String sysno = input.parameters().get("sysno");
        String record = input.parameters().get("record");
        String origin = null;
        if (input.page() != null) {
            try {
                var page = java.net.URI.create(input.page());
                origin = page.getScheme() + "://" + page.getAuthority();
            } catch (IllegalArgumentException ignored) {
                origin = null;
            }
        }
        return new EntryAnswer(sysno != null ? new CatalogId(sysno)
                : record != null ? new CatalogId(record) : null,
                input.parameters().get("unit"), input.parameters().get("reason"), origin);
    }
}
