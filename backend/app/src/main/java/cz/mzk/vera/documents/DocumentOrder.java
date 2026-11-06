package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import org.jooq.CaseConditionStep;
import org.jooq.Field;
import org.jooq.Record1;
import org.jooq.Select;
import org.jooq.SortField;
import org.jooq.impl.DSL;

// VIEW-documents-order: define the audience-specific list order once.
public final class DocumentOrder {
    private enum Priority {
        LOW("Low", 0.0), NORMAL("Normal", 1.0), HIGH("High", 2.0), URGENT("Urgent", 3.0);

        private final String wireName;
        private final double rank;

        Priority(String wireName, double rank) {
            this.wireName = wireName;
            this.rank = rank;
        }
    }

    // A document still in review has no priority yet; it sorts between Normal and High.
    private static final double UNDECIDED_PRIORITY_RANK = 1.5;

    private DocumentOrder() {}

    public static SortField<?> priority() {
        CaseConditionStep<Double> rank = DSL.case_()
            .when(ITERATIONS.PRIORITY.eq(Priority.LOW.wireName), Priority.LOW.rank);
        for (int index = 1; index < Priority.values().length; index++) {
            Priority priority = Priority.values()[index];
            rank = rank.when(ITERATIONS.PRIORITY.eq(priority.wireName), priority.rank);
        }
        return rank.otherwise(UNDECIDED_PRIORITY_RANK).desc();
    }

    public static SortField<?> activity() {
        return DSL.select(DSL.max(REQUESTS.AT)).from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)).asField().desc();
    }

    public static SortField<?> ownLatestAsk(String callerId, HeldScopes held) {
        return DSL.select(REQUESTS.AT).from(REQUESTS)
            .where(REQUESTS.ID.eq(publicRequestId(callerId, held, DOCUMENTS.ID)))
            .asField().desc().nullsLast();
    }

    public static Select<Record1<String>> publicRequestId(String callerId, HeldScopes held,
            Field<String> documentId) {
        return DSL.select(REQUESTS.ID).from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(documentId)
                .and(DocumentReach.requestCondition(held, callerId)))
            .orderBy(DSL.when(REQUESTS.REQUESTER_ID.eq(callerId), 0).otherwise(1), REQUESTS.AT.desc())
            .limit(1);
    }
}
