package cz.mzk.vera.testing.control;

import static cz.mzk.vera.db.tables.Tables.SESSIONS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.testing.seeds.SeedReader;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import cz.mzk.vera.session.SessionFilter;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.Problems;
import cz.mzk.vera.web.RouteCheck;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.exc.MismatchedInputException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.env.Environment;

@RestController
@RequestMapping("/_engine")
public class ControlController {
    private final StoredClock clock;
    private final SeedReader reader;
    private final TemplateResetService resetService;
    private final DSLContext dsl;
    private final RouteCheck routes;
    private final Environment environment;

    public ControlController(StoredClock clock, SeedReader reader, TemplateResetService resetService,
            DSLContext dsl, RouteCheck routes, Environment environment) {
        this.clock = clock;
        this.reader = reader;
        this.resetService = resetService;
        this.dsl = dsl;
        this.routes = routes;
        this.environment = environment;
    }

    @PostMapping("/reset")
    public ResponseEntity<?> reset(@RequestBody(required = false) ResetRequest request) {
        ResetRequest input = request == null ? new ResetRequest(null, null) : request;
        String seed = input.seed() == null ? "base" : input.seed();
        if (seed.isEmpty()) {
            return invalid(List.of(new FieldError("/seed", "too_small",
                    "Too small: expected string to have >=1 characters")));
        }
        try {
            resetService.reset(seed, Boolean.TRUE.equals(input.frozen()));
            return ResponseEntity.ok(Map.of("seed", seed, "now", Instants.format(clock.instant())));
        } catch (SeedReader.SeedNotFoundException exception) {
            return Problems.response(404, exception.getMessage());
        }
    }

    @PostMapping("/clock")
    public ResponseEntity<?> move(@RequestBody(required = false) ClockRequest request) {
        ClockRequest input = request == null ? new ClockRequest(null, null, null) : request;
        if (input.at() != null && input.advance() != null) {
            return invalid(List.of(new FieldError("", "custom", "Set the clock or advance it, not both.")));
        }
        List<FieldError> errors = validateAdvance(input.advance());
        if (!errors.isEmpty()) {
            return invalid(errors);
        }

        try {
            if (input.at() != null) {
                if (!input.at().matches(".*T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].*")) {
                    return invalid(List.of(new FieldError("/at", "invalid_format", "Invalid ISO datetime")));
                }
                clock.set(OffsetDateTime.parse(input.at()).toInstant());
            }
            if (input.advance() != null) {
                AdvanceRequest advance = input.advance();
                Duration amount = Duration.ofDays(valueOrZero(advance.days()))
                        .plusHours(valueOrZero(advance.hours()))
                        .plusMinutes(valueOrZero(advance.minutes()));
                clock.advance(amount);
            }
            if (Boolean.TRUE.equals(input.frozen())) {
                clock.freeze();
            } else if (Boolean.FALSE.equals(input.frozen())) {
                clock.unfreeze();
            }
            // Due jobs are run here when the backend adds them.
            return ResponseEntity.ok(Map.of("now", Instants.format(clock.instant()), "frozen", clock.isFrozen()));
        } catch (StoredClock.ClockBackwardsException exception) {
            return Problems.response(409, exception.getMessage(), "clock.backwards", null);
        } catch (DateTimeParseException exception) {
            return invalid(List.of(new FieldError("/at", "invalid_format", "Invalid ISO datetime")));
        }
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetail> unreadableBody(HttpMessageNotReadableException exception) {
        Throwable cause = exception.getMostSpecificCause();
        if (cause instanceof MismatchedInputException mismatch) {
            String detail = "Invalid input: expected " + expectedType(mismatch.getTargetType())
                    + ", received " + receivedType(mismatch.getCurrentToken());
            String pointer = mismatch.getPath().stream()
                    .map(JacksonException.Reference::getPropertyName)
                    .filter(property -> property != null)
                    .map(property -> "/" + property.replace("~", "~0").replace("/", "~1"))
                    .reduce("", String::concat);
            return invalid(List.of(new FieldError(pointer, "invalid_type", detail)));
        }
        String message = cause.getMessage();
        if (message != null && (message.contains("Unexpected character") || message.contains("Unexpected end"))) {
            return problem(400, "The body is not JSON.", null, null);
        }
        return problem(422, message == null ? "Invalid input" : message, "invalid", List.of(
                new FieldError("", "invalid_type", message == null ? "Invalid input" : message)));
    }

    private String expectedType(Class<?> type) {
        if (type == Boolean.class) {
            return "boolean";
        }
        if (type == String.class) {
            return "string";
        }
        if (Number.class.isAssignableFrom(type)) {
            return "number";
        }
        return "object";
    }

    private String receivedType(JsonToken token) {
        if (token == JsonToken.START_ARRAY) {
            return "array";
        }
        if (token == JsonToken.START_OBJECT) {
            return "object";
        }
        if (token == JsonToken.VALUE_STRING) {
            return "string";
        }
        if (token != null && token.isNumeric()) {
            return "number";
        }
        if (token != null && token.isBoolean()) {
            return "boolean";
        }
        return "null";
    }

    private List<FieldError> validateAdvance(AdvanceRequest advance) {
        if (advance == null) {
            return List.of();
        }
        List<FieldError> errors = new ArrayList<>();
        checkAmount(errors, "/advance/days", advance.days());
        checkAmount(errors, "/advance/hours", advance.hours());
        checkAmount(errors, "/advance/minutes", advance.minutes());
        return errors;
    }

    private void checkAmount(List<FieldError> errors, String pointer, Double amount) {
        if (amount == null || amount >= 0 && amount == Math.rint(amount)) {
            return;
        }
        if (amount < 0) {
            errors.add(new FieldError(pointer, "too_small", "Too small: expected number to be >=0"));
        } else {
            errors.add(new FieldError(pointer, "invalid_type", "Invalid input: expected int, received number"));
        }
    }

    private long valueOrZero(Double value) {
        return value == null ? 0 : value.longValue();
    }

    @PostMapping("/sessions")
    public ResponseEntity<?> openSession(@RequestBody(required = false) Map<String, String> input) {
        String userId = input == null ? null : input.get("userId");
        if (userId == null || userId.isEmpty()) {
            return invalid(List.of(new FieldError("/userId", "too_small",
                    "Too small: expected string to have >=1 characters")));
        }
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(userId)).fetchOne();
        if (user == null) return Problems.response(404, "There is no user named " + userId + ".");
        if ("agent".equals(user.getKind())) {
            return Problems.response(422, "An agent cannot sign in.", "access.agent_no_login", null);
        }
        if (user.getSuspendedAt() != null) {
            return Problems.response(403, "This user is suspended.", "access.suspended", null);
        }
        String token = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        dsl.insertInto(SESSIONS).set(SESSIONS.TOKEN_HASH, SessionFilter.hashOf(token))
                .set(SESSIONS.USER_ID, userId).set(SESSIONS.STARTED_AT, now)
                .set(SESSIONS.SEEN_AT, now).set(SESSIONS.RENEWED_AT, now).execute();
        boolean secure = !Arrays.asList(environment.getActiveProfiles()).contains("test");
        String cookie = "vera_session=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800"
                + (secure ? "; Secure" : "");
        return ResponseEntity.ok().header("Set-Cookie", cookie).body(Map.of("userId", userId));
    }

    @GetMapping("/endpoints")
    public List<String> endpoints() {
        return routes.servedOperationIds();
    }

    private ResponseEntity<ProblemDetail> invalid(List<FieldError> errors) {
        String detail = errors.isEmpty() ? "Not accepted" : errors.getFirst().detail();
        return problem(422, detail, "invalid", errors);
    }

    private ResponseEntity<ProblemDetail> problem(int status, String detail, String code, List<FieldError> errors) {
        return Problems.response(status, detail, code, errors);
    }

    public record ResetRequest(String seed, Boolean frozen) {}

    public record ClockRequest(String at, AdvanceRequest advance, Boolean frozen) {}

    public record AdvanceRequest(Double days, Double hours, Double minutes) {}

    public record FieldError(String pointer, String code, String detail) {}
}
