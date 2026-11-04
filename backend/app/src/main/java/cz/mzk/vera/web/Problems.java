package cz.mzk.vera.web;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

/** Builds the RFC 9457 refusals shared by the API boundary and control endpoints. */
public final class Problems {
    private static final Map<Integer, ProblemKind> KINDS = Map.of(
            400, new ProblemKind("bad_request", "Bad request"),
            401, new ProblemKind(null, "Not signed in"),
            403, new ProblemKind("forbidden", "Forbidden"),
            404, new ProblemKind("not_found", "Not found"),
            405, new ProblemKind("method_not_allowed", "Method not allowed"),
            409, new ProblemKind("conflict", "Conflict"),
            422, new ProblemKind("invalid", "Not accepted"),
            429, new ProblemKind("rate_limited", "Too many requests"),
            500, new ProblemKind("server_error", "Server error"));

    private Problems() {}

    public static ResponseEntity<ProblemDetail> response(int status, String detail) {
        return response(status, detail, null, null);
    }

    public static ResponseEntity<ProblemDetail> response(int status, String detail, String code, List<?> errors) {
        ProblemKind kind = KINDS.getOrDefault(status, new ProblemKind(null, "Error"));
        String actualCode = code == null ? kind.code() : code;
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.valueOf(status), detail);
        body.setTitle(kind.title());
        body.setType(actualCode == null
                ? URI.create("about:blank")
                : URI.create("https://vera.mzk.cz/problems/" + actualCode));
        if (actualCode != null) body.setProperty("code", actualCode);
        if (errors != null) body.setProperty("errors", errors);
        return ResponseEntity.status(status).header("Content-Type", "application/problem+json").body(body);
    }

    public record FieldError(String pointer, String code) {}

    private record ProblemKind(String code, String title) {}
}
