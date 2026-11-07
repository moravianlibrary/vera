package cz.mzk.vera.validations;

// ACT-accept; ACT-refusal: list and detail permission and refusal names live here.
final class ValidationCodes {
    static final String APPROVE = "validation.approve";
    static final String DENY = "validation.deny";
    static final String REVOKE = "validation.revoke";
    static final String NOT_WAITING = "validation.not_waiting";
    static final String MAY_NOT_REVIEW = "You may not review documents";
    static final String NOTHING_WAITS = "Nothing here waits for a verdict";

    private ValidationCodes() {}
}
