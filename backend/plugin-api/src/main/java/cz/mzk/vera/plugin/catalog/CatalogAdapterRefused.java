package cz.mzk.vera.plugin.catalog;

import cz.mzk.vera.plugin.PluginRefused;

// PLG-api-outcome; PLG-api-kinds: Catalog adapter.
public final class CatalogAdapterRefused extends PluginRefused {
    private static final long serialVersionUID = 1L;
    private final CatalogAdapterRefusal refusal;

    public CatalogAdapterRefused(CatalogAdapterRefusal refusal) {
        super(refusal.code());
        this.refusal = refusal;
    }

    public CatalogAdapterRefused(CatalogAdapterRefusal refusal, String message) {
        super(message);
        this.refusal = refusal;
    }

    @Override
    public String code() {
        return refusal.code();
    }
}
