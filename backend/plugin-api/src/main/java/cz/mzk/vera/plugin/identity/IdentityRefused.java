package cz.mzk.vera.plugin.identity;

import cz.mzk.vera.plugin.PluginRefused;

// PLG-api-outcome; PLG-api-kinds: Identity.
public final class IdentityRefused extends PluginRefused {
    private static final long serialVersionUID = 1L;

    private final IdentityRefusal refusal;

    public IdentityRefused(IdentityRefusal refusal) {
        this(refusal, refusal.code());
    }

    public IdentityRefused(IdentityRefusal refusal, String message) {
        super(message);
        this.refusal = refusal;
    }

    @Override
    public String code() {
        return refusal.code();
    }
}
