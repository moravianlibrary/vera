package cz.mzk.vera.documents;

// DOC-property-filter: property definition kinds that affect stored SQL values.
enum PropertyType {
    TEXT("text"), NUMBER("number"), DATE("date"), ENUM("enum"), YES_NO("yesNo");

    private final String wireName;

    PropertyType(String wireName) {
        this.wireName = wireName;
    }

    boolean matches(String value) {
        return wireName.equals(value);
    }

    static PropertyType fromWireName(String value) {
        for (PropertyType type : values()) {
            if (type.matches(value)) {
                return type;
            }
        }
        return null;
    }
}
