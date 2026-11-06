package cz.mzk.vera.documents;

// VIEW-documents-audience: keep the two document detail audiences closed.
public enum Audience {
    STAFF("staff"),
    PUBLIC("public");

    private final String wireName;

    Audience(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }
}
