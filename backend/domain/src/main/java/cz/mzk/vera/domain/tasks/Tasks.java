package cz.mzk.vera.domain.tasks;

import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.permissions.Permissions;
import java.util.List;

// ACT-run-cancel; ACT-run-again.
public final class Tasks {
  private Tasks() {}

  public record Run(String state, String startedBy, boolean rerunnable) {}
  public record Session(String userId, List<Grant> grants) {}

  public static boolean canCancelRun(Session session, Run run) {
    return run.state().equals("Running") && (run.startedBy() != null
        && run.startedBy().equals(session.userId())
        || Permissions.hasPermission(session.grants(), "task.cancel"));
  }

  public static boolean canRunAgain(Session session, Run run) {
    return run.rerunnable() && (run.state().equals("Failed") || run.state().equals("Cancelled"))
        && (run.startedBy() != null && run.startedBy().equals(session.userId())
        || Permissions.hasPermission(session.grants(), "plugin.run"));
  }
}
