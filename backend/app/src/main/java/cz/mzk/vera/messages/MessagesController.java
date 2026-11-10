package cz.mzk.vera.messages;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// MSG-handoff; MSG-recipients; MSG-order; MSG-keeps-nothing: map HTTP requests and answers.
@RestController
@RequestMapping("/api")
final class MessagesController {
    private final AccessGuard guard;
    private final MessageSubjects subjects;
    private final MessageCommands commands;

    MessagesController(AccessGuard guard, MessageSubjects subjects, MessageCommands commands) {
        this.guard = guard;
        this.subjects = subjects;
        this.commands = commands;
    }

    @GetMapping("/message-channels")
    ResponseEntity<?> channels(HttpServletRequest request) {
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(guard.callerOf(request));
        if (refusal != null) {
            return refusal;
        }
        return ResponseEntity.ok(commands.channels());
    }

    @GetMapping("/messages/hand-off")
    ResponseEntity<?> handOff(HttpServletRequest request,
            @RequestParam(name = "subject", required = false) String subject,
            @RequestParam(name = "id", required = false) String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (subject == null || id == null) {
            return Problems.response(422, "Choose what to message about", "message.subject_missing", null);
        }
        MessageSubjects.Subject resolved = subjects.resolve(caller.userId(), subject, id);
        if (resolved == null) {
            return Problems.response(404, "Nothing to message about here", "message.subject_not_found", null);
        }
        List<MessageSubjects.Recipient> recipients = subjects.recipients(resolved, caller.userId());
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> about = new LinkedHashMap<>();
        about.put("label", resolved.label());
        about.put("path", resolved.path());
        result.put("about", about);
        result.put("context", resolved.context());
        result.put("recipients", recipients.stream().map(MessageSubjects.Recipient::asMap).toList());
        result.put("handOffs", commands.handOffs(resolved, recipients));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/messages/send")
    ResponseEntity<?> send(HttpServletRequest request,
            @RequestParam(name = "subject", required = false) String subject,
            @RequestParam(name = "id", required = false) String id,
            @RequestBody Map<String, String> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (subject == null || id == null) {
            return Problems.response(422, "Choose what to message about", "message.recipient_missing", null);
        }
        String channelId = body.get("channelId");
        if (channelId == null) {
            return Problems.response(422, "Choose a message instance", "message.recipient_missing", null);
        }
        String text = body.get("text");
        if (text == null || text.isBlank()) {
            return Problems.response(422, "Write the message first", "message.text_missing", null);
        }
        if (!commands.canSend(channelId)) {
            return Problems.response(422, "This instance redirects.", "message.not_sending", null);
        }
        MessageSubjects.Subject resolved = subjects.resolve(caller.userId(), subject, id);
        if (resolved == null) {
            return Problems.response(404, "Nothing to message about here", "message.subject_not_found", null);
        }
        MessageCommands.SendResult sent = commands.send(channelId, resolved, caller.userId(), text);
        if (sent.reachedIds().isEmpty()) {
            return Problems.response(422, "This instance reaches nobody.", "message.unreachable", null);
        }
        if (!sent.sent()) {
            return Problems.response(503, "Message plugin unavailable");
        }
        return ResponseEntity.ok(Map.of("reachedIds", sent.reachedIds()));
    }
}
