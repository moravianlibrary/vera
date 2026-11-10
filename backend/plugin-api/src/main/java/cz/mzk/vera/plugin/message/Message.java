package cz.mzk.vera.plugin.message;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Message.
public interface Message {
    HandOffAnswer handOff(PluginContext context, HandOffInput input);
}
