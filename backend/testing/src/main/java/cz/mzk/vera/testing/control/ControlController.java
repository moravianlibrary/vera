package cz.mzk.vera.testing.control;

import cz.mzk.vera.testing.seeds.SeedReader;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.exc.MismatchedInputException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/_engine")
public class ControlController {
    private final StoredClock clock;
    private final SeedReader reader;
    private final TemplateResetService resetService;

    public ControlController(StoredClock clock, SeedReader reader, TemplateResetService resetService) {
        this.clock = clock;
        this.reader = reader;
        this.resetService = resetService;
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
            return ResponseEntity.ok(Map.of("seed", seed, "now", clock.instant().toString()));
        } catch (SeedReader.SeedNotFoundException exception) {
            return problem(404, exception.getMessage(), null, null);
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
            return ResponseEntity.ok(Map.of("now", clock.instant().toString(), "frozen", clock.isFrozen()));
        } catch (StoredClock.ClockBackwardsException exception) {
            return problem(409, exception.getMessage(), "clock.backwards", null);
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

    private ResponseEntity<ProblemDetail> invalid(List<FieldError> errors) {
        String detail = errors.isEmpty() ? "Not accepted" : errors.getFirst().detail();
        return problem(422, detail, "invalid", errors);
    }

    private ResponseEntity<ProblemDetail> problem(int status, String detail, String code, List<FieldError> errors) {
        HttpStatus httpStatus = HttpStatus.valueOf(status);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(httpStatus, detail);
        String problemCode = code == null ? defaultCode(status) : code;
        if (problemCode != null) {
            problem.setType(URI.create("https://vera.mzk.cz/problems/" + problemCode));
            problem.setProperty("code", problemCode);
        }
        problem.setTitle(title(status));
        if (errors != null) {
            problem.setProperty("errors", errors);
        }
        return ResponseEntity.status(httpStatus).body(problem);
    }

    private String defaultCode(int status) {
        return switch (status) {
            case 400 -> "bad_request";
            case 404 -> "not_found";
            case 409 -> "conflict";
            case 422 -> "invalid";
            default -> null;
        };
    }

    private String title(int status) {
        return switch (status) {
            case 400 -> "Bad request";
            case 404 -> "Not found";
            case 409 -> "Conflict";
            case 422 -> "Not accepted";
            default -> "Error";
        };
    }

    public record ResetRequest(String seed, Boolean frozen) {}

    public record ClockRequest(String at, AdvanceRequest advance, Boolean frozen) {}

    public record AdvanceRequest(Double days, Double hours, Double minutes) {}

    public record FieldError(String pointer, String code, String detail) {}
}
