package cz.mzk.vera.plugin.deliverychannel;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Delivery channel.
public interface DeliveryChannel {
    SendAnswer send(PluginContext context, SendInput input);
    TestAnswer test(PluginContext context, TestInput input);
}
