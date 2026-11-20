package cz.mzk.vera.jobs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// One environment-backed role value is shared by logging and the worker.
@Component
public class VeraRole {
    private final String value;

    public VeraRole(@Value("${vera.role:${VERA_ROLE:all}}") String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }
}
