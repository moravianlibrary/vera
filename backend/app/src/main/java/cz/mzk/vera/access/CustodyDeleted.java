package cz.mzk.vera.access;

// ACCESS-custody-delete; notifies Tasks after a custody is removed.
public record CustodyDeleted(String custodyId, String userId) {}
