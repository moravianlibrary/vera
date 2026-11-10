package cz.mzk.vera.messages;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.plugin.message.HandOffAnswer;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.web.PublicUrl;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// MSG-handoff; MSG-keeps-nothing: call Message plugins for redirects and sends.
@Component
final class MessageCommands {
    private final DSLContext dsl;
    private final PluginInstances instances;
    private final PluginCalls plugins;
    private final MessageSubjects subjects;
    private final PublicUrl publicUrl;

    MessageCommands(DSLContext dsl, PluginInstances instances, PluginCalls plugins,
            MessageSubjects subjects, PublicUrl publicUrl) {
        this.dsl = dsl;
        this.instances = instances;
        this.plugins = plugins;
        this.subjects = subjects;
        this.publicUrl = publicUrl;
    }

    List<Map<String, Object>> channels() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Message")) {
            String implementation = implementationOf(instance.id());
            if (implementation == null) {
                continue;
            }
            Map<String, Object> channel = new LinkedHashMap<>();
            channel.put("id", instance.id());
            channel.put("name", instance.name());
            channel.put("description", description(implementation));
            channel.put("result", "slackBot".equals(implementation) ? "sent" : "redirect");
            result.add(channel);
        }
        return result;
    }

    List<Map<String, Object>> handOffs(MessageSubjects.Subject subject,
            List<MessageSubjects.Recipient> recipients) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Message")) {
            String implementation = implementationOf(instance.id());
            if (implementation == null) {
                continue;
            }
            List<String> reachable = subjects.reachable(instance.id(), implementation, recipients);
            String href = handOff(instance, implementation, subject, reachable);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("channelId", instance.id());
            item.put("reachableIds", reachable);
            item.put("href", href);
            result.add(item);
        }
        return result;
    }

    boolean canSend(String channelId) {
        return "slackBot".equals(implementationOf(channelId));
    }

    SendResult send(String channelId, MessageSubjects.Subject subject, String sender, String text) {
        String implementation = implementationOf(channelId);
        List<String> reachedIds = subjects.reachable(channelId, implementation,
                subjects.recipients(subject, sender));
        if (reachedIds.isEmpty()) {
            return new SendResult(reachedIds, false);
        }
        PluginOutcome<HandOffAnswer> outcome = plugins.call(channelId, Message.class, "handOff",
                (plugin, context) -> plugin.handOff(context,
                        new HandOffInput(reachedIds, "[VERA] " + subject.label(), text)));
        boolean sent = outcome instanceof PluginOutcome.Answered<HandOffAnswer> answer
                && answer.answer().sent();
        return new SendResult(reachedIds, sent);
    }

    private String handOff(PluginInstances.Instance instance, String implementation,
            MessageSubjects.Subject subject, List<String> reachable) {
        if (reachable.isEmpty() || "slackBot".equals(implementation)) {
            return null;
        }
        String link = publicUrl.value() + subject.path();
        PluginOutcome<HandOffAnswer> outcome = plugins.call(instance.id(), Message.class,
                "handOff", (plugin, context) -> plugin.handOff(context,
                        new HandOffInput(subjects.routedRecipients(instance.id(), implementation, reachable),
                                "[VERA] " + subject.label(), subject.context() + "\n\n" + link)));
        if (!(outcome instanceof PluginOutcome.Answered<HandOffAnswer> answer)) {
            return null;
        }
        String href = answer.answer().address();
        if ("mailto".equals(implementation)) {
            int query = href.indexOf('?');
            if (query >= 0) {
                href = href.substring(0, query) + href.substring(query).replace("+", "%20");
            }
        }
        return href;
    }

    private String implementationOf(String instanceId) {
        String descriptor = dsl.select(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId).and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                        .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()))
                .fetchOne(0, String.class);
        if (descriptor == null) {
            return null;
        }
        return switch (descriptor) {
            case "cz.mzk.vera.mailto-message" -> "mailto";
            case "cz.mzk.vera.slack-message" -> "slack";
            case "cz.mzk.vera.slack-bot-message" -> "slackBot";
            default -> null;
        };
    }

    private String description(String implementation) {
        return switch (implementation) {
            case "mailto" -> "opens your mail, pre-filled";
            case "slack" -> "opens a Slack message";
            default -> "sends a Slack direct message";
        };
    }

    record SendResult(List<String> reachedIds, boolean sent) {}
}
