package cz.mzk.vera.documents;

// DOC-property-values: definitions read either document or current-attempt values.
enum PropertyAbout {
    DOCUMENT("document"), ATTEMPT("attempt");

    private final String wireName;

    PropertyAbout(String wireName) {
        this.wireName = wireName;
    }

    boolean matches(String value) {
        return wireName.equals(value);
    }

    static PropertyAbout fromWireName(String value) {
        for (PropertyAbout about : values()) {
            if (about.matches(value)) {
                return about;
            }
        }
        return null;
    }
}
