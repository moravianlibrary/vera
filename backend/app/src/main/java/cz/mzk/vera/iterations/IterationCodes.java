package cz.mzk.vera.iterations;

// ACT-reclassify; ACT-publish; ACT-link-replace; ACT-link-primary; ACT-link-remove.
public final class IterationCodes {
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

    private IterationCodes() {}
}
