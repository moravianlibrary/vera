package cz.mzk.vera.plugin.input;

import cz.mzk.vera.plugin.PluginRefused;

// PLG-api-outcome; PLG-api-kinds: Input.
public final class InputRefused extends PluginRefused {
    private static final long serialVersionUID = 1L;
    private final InputRefusal refusal;

    public InputRefused(InputRefusal refusal) {
        super(refusal.code());
        this.refusal = refusal;
    }

    public InputRefused(InputRefusal refusal, String message) {
        super(message);
        this.refusal = refusal;
    }

    @Override
    public String code() {
        return refusal.code();
    }
}
