package cz.mzk.vera.tasks;

import cz.mzk.vera.access.CustodyDeleted;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// ACCESS-custody-delete; starts placement again in the custody deletion transaction.
@Component
class CustodyDeletedListener {
    private final Runs runs;

    CustodyDeletedListener(Runs runs) {
        this.runs = runs;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    void custodyDeleted(CustodyDeleted event) {
        runs.startPlacing(event.userId(), Map.of("label", "Users & Groups",
                "path", "/access?c=" + event.custodyId() + "&view=custodies&type=proposals"));
    }
}
