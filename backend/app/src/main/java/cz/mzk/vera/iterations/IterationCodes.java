package cz.mzk.vera.iterations;

// ACT-current-attempt; ACT-reclassify; ACT-publish; ACT-link-replace; ACT-link-primary; ACT-link-remove;
// ACT-cancel; ACT-resume; ACT-overrule; ACT-page-count; ACT-recheck.
public final class IterationCodes {
    public static final String RECHECK = "iteration.recheck";
    public static final String CANCEL = "iteration.cancel";
    public static final String RESUME = "iteration.resume";
    public static final String OVERRULE = "restriction.overrule";
    public static final String CLASSIFY = "iteration.classify";
    public static final String PUBLISH = "iteration.publish";
    public static final String SCANNED = "iteration.scanned";
    public static final String NOT_DIGITIZED = "iteration.not_digitized";
    public static final String NOTHING_CHANGED = "iteration.nothing_changed";
    public static final String OUTSIDE_CUSTODY = "iteration.outside_custody";
    public static final String NOT_CURRENT = "iteration.not_current";
    public static final String LINK_UNREAD = "iteration.link_unread";
    public static final String LINK_EXISTS = "iteration.link_exists";
    public static final String ALREADY_PRIMARY_LINK = "iteration.already_primary_link";
    public static final String LAST_LINK = "iteration.last_link";
    public static final String CATEGORY_NOT_LEAF = "category.not_leaf";
    public static final String ALREADY_HELD = "iteration.already_held";
    public static final String NOT_HELD = "iteration.not_held";
    public static final String NO_RESTRICTION = "iteration.no_restriction";

    private IterationCodes() {}
}
