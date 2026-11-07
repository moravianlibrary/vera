package cz.mzk.vera.proposals;

// ACT-propose; ACT-ways-in; PLG-api-capabilities: shared proposal operation and refusal names.
final class ProposalCodes {
    static final String REQUEST_CREATE = "request.create";
    static final String CATALOG_ADAPTER = "CatalogAdapter";
    static final String IDENTIFIER = "Identifier";
    static final String INPUT = "Input";
    static final String SEARCH = "search";
    static final String SYNC = "sync";
    static final String ENTRY = "entry";
    static final String READ_LINK = "readLink";
    static final String READ_BARCODE = "readBarcode";
    static final String READ_PHOTO = "readPhoto";
    static final String LINK_UNREAD = "proposal.link_unread";
    static final String NO_BARCODE_READER = "proposal.no_barcode_reader";
    static final String NO_PHOTO_READER = "proposal.no_photo_reader";
    static final String PHOTO_MISSING = "proposal.photo_missing";

    private ProposalCodes() {}
}
