package cz.mzk.vera.plugin.input;

// PLG-api-outcome; PLG-api-kinds: Input.
public enum InputRefusal {
    UNREADABLE("unreadable"), ORIGIN_NOT_ALLOWED("origin_not_allowed");

    private final String code;

    InputRefusal(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static InputRefusal of(String code) {
        for (InputRefusal refusal : values()) {
            if (refusal.code.equals(code)) {
                return refusal;
            }
        }
        throw new IllegalArgumentException("Unknown input refusal code: " + code);
    }
}
