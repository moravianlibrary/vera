package cz.mzk.vera.documents;

// VIEW-documents-audience; DOC-property-visibility: shared wire codes and permission names.
public final class DocumentCodes {
    public static final String PUBLIC_VISIBILITY = "public";
    public static final String ITERATION_READ = "iteration.read";
    public static final String REQUEST_READ_INGEST = "request.read_ingest";
    public static final String REQUEST_READ_MINE = "request.read_mine";
    public static final String REQUEST_READ = "request.read";
    public static final String REQUEST_DECIDE = "request.decide";
    public static final String REQUEST_WITHDRAW_OWN = "request.withdraw_own";

    private DocumentCodes() {}
}
