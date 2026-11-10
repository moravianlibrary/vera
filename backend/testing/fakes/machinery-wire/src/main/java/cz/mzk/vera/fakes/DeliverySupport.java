package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannelRefusal;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannelRefused;
import cz.mzk.vera.plugin.deliverychannel.SendAnswer;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.plugin.deliverychannel.TestAnswer;
import cz.mzk.vera.plugin.deliverychannel.TestInput;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Delivery channel; PLG-api-outcome.
public class DeliverySupport implements DeliveryChannel {
    private final String channel;
    public DeliverySupport(String channel) { this.channel = channel; }
    @Override public SendAnswer send(PluginContext context, SendInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "channel", channel);
        Wire.put(fields, "recipient", input.recipient());
        Wire.put(fields, "payload", jsonOf(input.payload()));
        Map<String, List<String>> result = Wire.send(context, "deliverySend", fields);
        if ("unavailable".equals(Wire.first(result, "fault"))) {
            throw new cz.mzk.vera.plugin.PluginUnavailable(Wire.first(result, "detail"));
        }
        if ("recipient_rejected".equals(Wire.first(result, "fault"))) {
            throw new DeliveryChannelRefused(DeliveryChannelRefusal.RECIPIENT_REJECTED,
                    "Recipient rejected.");
        }
        return new SendAnswer(true);
    }
    @Override public TestAnswer test(PluginContext context, TestInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "channel", channel);
        Wire.put(fields, "recipient", input.recipient());
        Map<String, List<String>> result = Wire.send(context, "deliveryTest", fields);
        if ("unavailable".equals(Wire.first(result, "fault"))
                || "recipient_rejected".equals(Wire.first(result, "fault"))) {
            return new TestAnswer(false, 0);
        }
        return new TestAnswer(true, 0);
    }

    private String jsonOf(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String text) {
            return quote(text);
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof Map<?, ?> map) {
            StringBuilder result = new StringBuilder("{");
            map.forEach((key, item) -> {
                if (result.length() > 1) {
                    result.append(',');
                }
                result.append(quote(String.valueOf(key))).append(':').append(jsonOf(item));
            });
            return result.append('}').toString();
        }
        if (value instanceof Iterable<?> values) {
            StringBuilder result = new StringBuilder("[");
            for (Object item : values) {
                if (result.length() > 1) {
                    result.append(',');
                }
                result.append(jsonOf(item));
            }
            return result.append(']').toString();
        }
        return quote(value.toString());
    }

    private String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }
}
