package cz.mzk.vera.documents;

// DOC-property-predefined and DOC-page-count: keys fixed by the property contract.
enum PropertyKey {
    PAGE_COUNT("page_count"), MATERIAL_TYPE("material_type"), SHELF_MARK("shelf_mark"), TITLE("title");

    private final String wireName;

    PropertyKey(String wireName) {
        this.wireName = wireName;
    }

    String wireName() {
        return wireName;
    }

    static PropertyKey of(String value) {
        for (PropertyKey key : values()) {
            if (key.wireName.equals(value)) {
                return key;
            }
        }
        return null;
    }
}
