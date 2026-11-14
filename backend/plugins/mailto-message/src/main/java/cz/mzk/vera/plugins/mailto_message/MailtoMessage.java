package cz.mzk.vera.plugins.mailto_message;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.message.HandOffAnswer;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

// MSG-handoff; PLG-api-kinds: Message.
public final class MailtoMessage implements Message {
    @Override
    public HandOffAnswer handOff(PluginContext context, HandOffInput input) {
        String recipients = String.join(",", input.recipients());
        StringBuilder address = new StringBuilder("mailto:");
        address.append(recipients);
        address.append("?subject=").append(encode(input.subject()));
        address.append("&body=").append(encode(input.text()));
        if ("on".equals(context.configuration().get("cc_sender")) && input.sender() != null
                && !input.sender().isBlank()) {
            address.append("&cc=").append(encode(input.sender()));
        }
        return new HandOffAnswer(address.toString(), false);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
