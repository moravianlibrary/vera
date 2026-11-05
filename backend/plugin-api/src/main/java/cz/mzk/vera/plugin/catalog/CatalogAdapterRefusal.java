package cz.mzk.vera.plugin.catalog;

// PLG-api-outcome; PLG-api-kinds: Catalog adapter.
public enum CatalogAdapterRefusal {
    NOT_FOUND("not_found"), NOT_THIS_CATALOG("not_this_catalog"), MALFORMED("malformed");

    private final String code;

    CatalogAdapterRefusal(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static CatalogAdapterRefusal of(String code) {
        for (CatalogAdapterRefusal refusal : values()) {
            if (refusal.code.equals(code)) {
                return refusal;
            }
        }
        throw new IllegalArgumentException("Unknown catalog adapter refusal code: " + code);
    }
}
