package cz.mzk.vera.plugin.identity;

// PLG-api-outcome; PLG-api-kinds: Identity.
public enum IdentityRefusal {
    WRONG_CREDENTIALS("wrong_credentials"),
    SUSPENDED("suspended"),
    NOT_ALLOWED("not_allowed");

    private final String code;

    IdentityRefusal(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }
}
