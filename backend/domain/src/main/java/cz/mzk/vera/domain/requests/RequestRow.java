package cz.mzk.vera.domain.requests;

import cz.mzk.vera.domain.entities.DocumentRecord;
import java.util.List;

// VIEW-requests: the request list read model.
public record RequestRow(
    DocumentRecord record, ProposalDecision decision, List<String> custodyIds, Suggestion suggestion) {}
