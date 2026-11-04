package cz.mzk.vera.plugin;

// PLG-api-outcome.
public abstract class PluginRefused extends RuntimeException {
    private static final long serialVersionUID = 1L;

    protected PluginRefused(String message) {
        super(message);
    }

    public abstract String code();

    @Override
    public String getMessage() {
        return message();
    }

    public String message() {
        return super.getMessage();
    }
}
