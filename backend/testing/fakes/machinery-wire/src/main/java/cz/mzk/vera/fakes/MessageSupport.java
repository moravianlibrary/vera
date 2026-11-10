package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.message.HandOffAnswer;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Message; fakes.md Message.
public class MessageSupport implements Message {
    private final String kind;
    public MessageSupport(String kind) { this.kind = kind; }
    @Override public HandOffAnswer handOff(PluginContext context, HandOffInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "kind", kind);
        input.recipients().forEach(recipient -> Wire.put(fields, "recipient", recipient));
        Wire.put(fields, "subject", input.subject());
        Wire.put(fields, "text", input.text());
        Map<String, List<String>> answer = Wire.send(context, "message", fields);
        return new HandOffAnswer(Wire.first(answer, "address"), "true".equals(Wire.first(answer, "sent")));
    }
}
