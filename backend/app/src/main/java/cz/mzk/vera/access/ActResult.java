package cz.mzk.vera.access;

import cz.mzk.vera.web.Problems;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

record ActResult(int status, String detail, String code, Object body) {
    static ActResult ok(Object body) {
        return new ActResult(200, null, null, body);
    }

    static ActResult noContent() {
        return new ActResult(204, null, null, null);
    }

    static ActResult refused(int status, String detail, String code) {
        return new ActResult(status, detail, code, null);
    }

    static ActResult unknown(String what) {
        return refused(404, "No such " + what, "not_found");
    }

    static ActResult nameTaken(String name) {
        return refused(409, "There is already one called " + name, "access.name_taken");
    }

    static ResponseEntity<?> answer(ActResult result) {
        if (result.status() == 204) {
            return ResponseEntity.noContent().build();
        }
        if (result.detail() != null) {
            return Problems.response(result.status(), result.detail(), result.code(), null);
        }
        return ResponseEntity.ok(result.body());
    }
}
