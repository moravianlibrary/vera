package cz.mzk.vera.plugin.deliverychannel;

import cz.mzk.vera.plugin.PluginRefused;

// PLG-api-outcome.
public final class DeliveryChannelRefused extends PluginRefused {
    private static final long serialVersionUID = 1L;
    private final DeliveryChannelRefusal code;

    public DeliveryChannelRefused(DeliveryChannelRefusal code, String message) {
        super(message);
        this.code = code;
    }

    @Override
    public String code() {
        return code.name().toLowerCase();
    }
}
