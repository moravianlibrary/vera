package cz.mzk.vera.validations;

// ACT-accept; ACT-refusal: list and detail permission and refusal names live here.
final class ValidationCodes {
    static final String APPROVE = "validation.approve";
    static final String DENY = "validation.deny";
    static final String REVOKE = "validation.revoke";
    static final String NOT_WAITING = "validation.not_waiting";
    static final String MAY_NOT_REVIEW = "You may not review documents";
    static final String NOTHING_WAITS = "Nothing here waits for a verdict";
    static final String FORBIDDEN_BY_RULE = "validation.forbidden_by_rule";
    static final String DEFECTS_NOT_ACCEPTED = "validation.defects_not_accepted";
    static final String NOT_WAITING_MESSAGE = "It is no longer waiting for review";
    static final String DEFECTS_CHANGED = "The defects have changed meanwhile";
    static final String MAY_NOT_GIVE = "You may not give this verdict";

    private ValidationCodes() {}
}
