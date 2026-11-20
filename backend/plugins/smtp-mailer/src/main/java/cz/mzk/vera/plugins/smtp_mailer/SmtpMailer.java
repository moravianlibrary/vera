package cz.mzk.vera.plugins.smtp_mailer;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannelRefusal;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannelRefused;
import cz.mzk.vera.plugin.deliverychannel.SendAnswer;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.plugin.deliverychannel.TestAnswer;
import cz.mzk.vera.plugin.deliverychannel.TestInput;
import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import org.eclipse.angus.mail.smtp.SMTPAddressFailedException;
import org.eclipse.angus.mail.smtp.SMTPTransport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Properties;

// PLG-api-kinds: Delivery channel; PLG-api-outcome.
public final class SmtpMailer implements DeliveryChannel {
    @Override
    public SendAnswer send(PluginContext context, SendInput input) {
        Session session = Session.getInstance(properties(context));
        try (Transport transport = connect(context, session)) {
            MimeMessage message = message(context, input, session);
            transport.sendMessage(message, new Address[] { InternetAddress.parse(input.recipient(), true)[0] });
            return new SendAnswer(true);
        } catch (MessagingException exception) {
            if (recipientRejected(exception)) {
                throw new DeliveryChannelRefused(DeliveryChannelRefusal.RECIPIENT_REJECTED,
                        "The SMTP server rejected the recipient.");
            }
            throw new PluginUnavailable("SMTP send failed: " + exception.getMessage());
        }
    }

    @Override
    public TestAnswer test(PluginContext context, TestInput input) {
        Instant start = context.clock().instant();
        Session session = Session.getInstance(properties(context));
        try (Transport transport = connect(context, session)) {
            transport.isConnected();
            SMTPTransport smtp = (SMTPTransport) transport;
            smtp.issueCommand("NOOP", 250);
            smtp.issueCommand("QUIT", 221);
            return new TestAnswer(true, elapsed(context, start));
        } catch (MessagingException exception) {
            return new TestAnswer(false, elapsed(context, start));
        }
    }

    private Transport connect(PluginContext context, Session session) throws MessagingException {
        Transport transport = session.getTransport("smtp");
        transport.connect(host(context), port(context), username(context), password(context));
        return transport;
    }

    private MimeMessage message(PluginContext context, SendInput input, Session session) throws MessagingException {
        Map<?, ?> payload = input.payload() instanceof Map<?, ?> map ? map : Map.of();
        MimeMessage message = new MimeMessage(session);
        message.setFrom(new InternetAddress(required(context, "from"), true));
        message.setRecipient(Message.RecipientType.TO, new InternetAddress(input.recipient(), true));
        String replyTo = context.configuration().get("reply_to");
        if (replyTo != null && !replyTo.isBlank()) message.setReplyTo(InternetAddress.parse(replyTo, true));
        message.setSubject(string(payload.get("subject")), StandardCharsets.UTF_8.name());
        message.setSentDate(Date.from(context.clock().instant()));
        message.setHeader("Message-ID", "<" + context.instanceId() + "." +
                context.clock().instant().toEpochMilli() + "@vera>");
        String plain = body(payload);
        Object htmlValue = payload.get("html");
        if (htmlValue == null) htmlValue = payload.get("htmlBody");
        if (htmlValue == null) {
            message.setText(plain, StandardCharsets.UTF_8.name());
        } else {
            MimeBodyPart textPart = new MimeBodyPart();
            textPart.setText(plain, StandardCharsets.UTF_8.name());
            MimeBodyPart htmlPart = new MimeBodyPart();
            htmlPart.setContent(string(htmlValue), "text/html; charset=UTF-8");
            MimeMultipart alternative = new MimeMultipart("alternative");
            alternative.addBodyPart(textPart);
            alternative.addBodyPart(htmlPart);
            message.setContent(alternative);
        }
        return message;
    }

    private String body(Map<?, ?> payload) {
        for (String key : new String[] { "text", "body", "textBody", "message" }) {
            if (payload.get(key) != null) return string(payload.get(key));
        }
        Object link = payload.get("link");
        if (link != null) return string(link);
        if (payload.containsKey("records")) return "New records have been added to your watchlists.\n" + string(payload.get("manageUrl"));
        if (payload.containsKey("watchlistName")) return string(payload.get("reason")) + "\n" + string(payload.get("manageUrl"));
        return payload.toString();
    }

    private boolean recipientRejected(MessagingException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof jakarta.mail.SendFailedException failed && failed.getInvalidAddresses() != null) return true;
            if (cause instanceof SMTPAddressFailedException addressFailure) {
                return addressFailure.getReturnCode() >= 500;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private Properties properties(PluginContext context) {
        Properties props = new Properties();
        props.setProperty("mail.smtp.host", host(context));
        props.setProperty("mail.smtp.port", Integer.toString(port(context)));
        props.setProperty("mail.smtp.connectiontimeout", timeoutMillis(context));
        props.setProperty("mail.smtp.timeout", timeoutMillis(context));
        props.setProperty("mail.smtp.writetimeout", timeoutMillis(context));
        props.setProperty("mail.smtp.auth", Boolean.toString(username(context) != null));
        String tls = context.configuration().getOrDefault("tls", "starttls");
        if ("starttls".equals(tls)) {
            props.setProperty("mail.smtp.starttls.enable", "true");
            props.setProperty("mail.smtp.starttls.required", "true");
        } else if ("tls".equals(tls)) {
            props.setProperty("mail.smtp.ssl.enable", "true");
        } else if (!"none".equals(tls)) {
            throw new IllegalArgumentException("tls must be starttls, tls, or none");
        }
        return props;
    }

    private String timeoutMillis(PluginContext context) {
        String value = context.configuration().getOrDefault("timeout", "30s");
        Duration duration = value.endsWith("ms") ? Duration.ofMillis(Long.parseLong(value.substring(0, value.length() - 2)))
                : Duration.ofSeconds(Long.parseLong(value.replaceAll("s$", "")));
        return Long.toString(duration.toMillis());
    }

    private String host(PluginContext context) { return required(context, "host"); }
    private int port(PluginContext context) { return Integer.parseInt(context.configuration().getOrDefault("port", "587")); }
    private String username(PluginContext context) { return blankToNull(context.configuration().get("username")); }
    private String password(PluginContext context) { return blankToNull(context.secrets().get("password")); }
    private String required(PluginContext context, String key) {
        String value = context.configuration().get(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing SMTP configuration: " + key);
        return value;
    }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
    private String string(Object value) { return value == null ? "" : String.valueOf(value); }
    private long elapsed(PluginContext context, Instant start) {
        return Math.max(0, Duration.between(start, context.clock().instant()).toMillis());
    }
}
