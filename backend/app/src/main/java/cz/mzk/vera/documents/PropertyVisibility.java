package cz.mzk.vera.documents;

// DOC-property-visibility: property definitions declare one visibility audience.
enum PropertyVisibility {
    PUBLIC("public"), STAFF("staff");

    private final String wireName;

    PropertyVisibility(String wireName) {
        this.wireName = wireName;
    }

    static PropertyVisibility fromWireName(String value) {
        for (PropertyVisibility visibility : values()) {
            if (visibility.wireName.equals(value)) {
                return visibility;
            }
        }
        return null;
    }
}
