package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.selectOne;

import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import org.jooq.Condition;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-requests; ACCESS-membership-not-capability; SCOPE-project: apply each permission's row reach.
@Component
public class RequestReach {
    private final RequestRows rows;

    public RequestReach(RequestRows rows) {
        this.rows = rows;
    }

    public boolean canReadRequests(HeldScopes held) {
        return !held.scopesOf(DocumentCodes.REQUEST_READ).isEmpty();
    }

    public Condition condition(HeldScopes held, String callerId, String permission, Field<String> documentId) {
        Condition inReach = DSL.falseCondition();
        for (String scope : held.scopesOf(permission)) {
            if (scope.equals("any")) {
                return rows.documentHasRow(documentId);
            } else if (scope.equals("custody")) {
                Condition member = REQUEST_CUSTODY_MEMBERS.USER_ID.eq(callerId);
                if (!held.groupIds().isEmpty()) {
                    member = member.or(REQUEST_CUSTODY_GROUPS.GROUP_ID.in(held.groupIds()));
                }
                Table<?> rowCustodies = rows.custodies();
                Field<String> rowDocumentId = rowCustodies.field("document_id", String.class);
                Field<String> custodyId = rowCustodies.field("custody_id", String.class);
                inReach = inReach.or(exists(selectOne().from(rowCustodies
                                .leftJoin(REQUEST_CUSTODY_MEMBERS)
                                .on(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID.eq(custodyId))
                                .leftJoin(REQUEST_CUSTODY_GROUPS)
                                .on(REQUEST_CUSTODY_GROUPS.CUSTODY_ID.eq(custodyId)))
                        .where(rowDocumentId.eq(documentId).and(member))));
            } else if (scope.equals("project") && !held.projectIds().isEmpty()) {
                Table<?> requestRows = rows.rows();
                Field<String> rowDocumentId = requestRows.field("document_id", String.class);
                Field<String> decision = requestRows.field("decision", String.class);
                var projectAsks = requestRows
                                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(rowDocumentId)
                                        .and(REQUESTS.DECISION.eq(decision)));
                inReach = inReach.or(exists(selectOne().from(projectAsks)
                        .where(rowDocumentId.eq(documentId)
                                .and(REQUESTS.PROJECT_ID.in(held.projectIds())))));
            }
        }
        return rows.documentHasRow(documentId).and(inReach);
    }
}
