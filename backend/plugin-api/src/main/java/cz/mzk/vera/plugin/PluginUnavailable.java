package cz.mzk.vera.plugin;

// PLG-api-outcome.
public final class PluginUnavailable extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public PluginUnavailable(String message) {
        super(message);
    }

    public PluginUnavailable(String message, Throwable cause) {
        super(message, cause);
    }
}
