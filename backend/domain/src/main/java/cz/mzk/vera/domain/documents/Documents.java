package cz.mzk.vera.domain.documents;

import cz.mzk.vera.domain.entities.Batch;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.ExistingCopy;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.RegistryRecord;
import cz.mzk.vera.domain.entities.RegistryState;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.status.Status;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// LC-REQ-join, VIEW-documents-audience, ENT-batch, DOC-property-values, DOC-identifiers.
public final class Documents {
  private Documents() {
  }

  public enum Audience {
    Staff("staff"),
    Public("public");

    private final String wireName;

    Audience(String wireName) {
      this.wireName = wireName;
    }

    public String wireName() {
      return wireName;
    }
  }

  public enum AskDecision { Pending, Approved, Denied, Withdrawn }

  public enum AdditionState {
    Awaiting("awaiting"),
    Declined("declined"),
    Withdrawn("withdrawn"),
    Forbidden("forbidden"),
    ReviewNeeded("reviewNeeded"),
    DeniedInReview("deniedInReview"),
    Adding("adding"),
    Failed("failed"),
    Added("added"),
    Cancelled("cancelled");

    private final String wireName;

    AdditionState(String wireName) {
      this.wireName = wireName;
    }

    public String wireName() {
      return wireName;
    }
  }

  public enum ExistingCopyState { CheckFailed, Unmapped, Planned, InProgress, Digitized, Published, None }
  public static Iteration currentIterationOf(DocumentRecord record) {
    return record.iterations().isEmpty() ? null : record.iterations().getLast();
  }

  public static boolean isAttemptOver(Iteration iteration) {
    return iteration.progress() == Progress.Published || iteration.cancellation() != null;
  }

  public static Iteration iterationOf(DocumentRecord record, String id) {
    return record.iterations().stream().filter(value -> value.id().equals(id)).findFirst().orElse(null);
  }

  public static String followedIterationId(Request request) {
    if (request.decision() == Decision.Approved) {
      return request.iteration() == null ? null : request.iteration().iterationId();
    }
    return request.decision() == Decision.Duplicate ? request.tracksIterationId() : null;
  }

  public static List<Request> askersOf(DocumentRecord record) {
    Iteration current = currentIterationOf(record);
    if (current == null) {
      return record.requests();
    }
    return record.requests()
        .stream()
        .filter(request
            -> request.decision() == Decision.Pending || current.id().equals(followedIterationId(request)))
        .toList();
  }

  public static List<Request> requestsBy(DocumentRecord record, String userId) {
    return record.requests()
        .stream()
        .filter(request -> request.requesterId().equals(userId))
        .sorted(Comparator.comparing(Request::at).reversed())
        .toList();
  }

  public static Request latestPublicAskOf(DocumentRecord record, String userId) {
    List<Request> own = requestsBy(record, userId);
    if (!own.isEmpty()) {
      return own.getFirst();
    }
    return record.requests().stream().max(Comparator.comparing(Request::at)).orElse(null);
  }

  public static List<ExistingCopy> existingCopiesOf(List<Request> requests) {
    Map<String, ExistingCopy> copies = new LinkedHashMap<>();
    for (Request request : requests) {
      for (ExistingCopy copy : request.existingCopies()) {
        copies.put(copy.source() + "-" + copy.iterationId(), copy);
      }
    }
    return List.copyOf(copies.values());
  }

  public static Status.DisplayStatus recordStatusOf(DocumentRecord record) {
    Iteration current = currentIterationOf(record);
    if (current != null) {
      return Status.iterationStatusOf(current);
    }
    for (AskDecision decision : AskDecision.values()) {
      if (record.requests().stream().anyMatch(request -> askDecisionOf(request.decision()) == decision)) {
        return Status.decisionStatusOf(switch (decision) {
          case Pending -> Decision.Pending;
          case Approved -> Decision.Approved;
          case Denied -> Decision.Denied;
          case Withdrawn -> Decision.Withdrawn;
        });
      }
    }
    return null;
  }

  public static Status.PublicStatus publicRecordStatusOf(DocumentRecord record, String userId) {
    Request latest = latestPublicAskOf(record, userId);
    if (latest == null) {
      return null;
    }
    String iterationId = followedIterationId(latest);
    return Status.publicStatusOf(latest, iterationId == null ? null : iterationOf(record, iterationId));
  }

  public static String projectIdOf(DocumentRecord record) {
    Iteration current = currentIterationOf(record);
    if (current != null) {
      return current.projectId();
    }
    return record.requests()
        .stream()
        .map(Request::projectId)
        .filter(value -> value != null)
        .findFirst()
        .orElse(null);
  }

  public static boolean isShownAsBatch(Batch batch) {
    return batch.size() >= 2;
  }

  public static String batchIdOf(DocumentRecord record) {
    Iteration current = currentIterationOf(record);
    if (current != null) {
      return record.requests()
          .stream()
          .filter(request -> request.id().equals(current.requestId()))
          .map(Request::batchId)
          .findFirst()
          .orElse(null);
    }
    return record.requests().isEmpty() ? null : record.requests().getFirst().batchId();
  }

  public static AdditionState additionStateOf(DocumentRecord record) {
    Status.DisplayStatus status = recordStatusOf(record);
    if (status == null) {
      return null;
    }
    return switch (status) {
      case AwaitingReview -> AdditionState.Awaiting;
      case Declined -> AdditionState.Declined;
      case Withdrawn -> AdditionState.Withdrawn;
      case Forbidden -> AdditionState.Forbidden;
      case ReviewNeeded -> AdditionState.ReviewNeeded;
      case ValidationDenied -> AdditionState.DeniedInReview;
      case BeingAdded, Enqueued -> AdditionState.Adding;
      case IngestFailed -> AdditionState.Failed;
      case Ready, Planned, InProgress, Digitized, Published -> AdditionState.Added;
      case Cancelled, NotDigitizable -> AdditionState.Cancelled;
    };
  }

  public static PageSource effectivePageCount(Document document) {
    return document.pageSources().stream().max(Comparator.comparingInt(PageSource::tier)).orElse(null);
  }

  public static RegistryRecord strongestRegistryRecord(Document document) {
    return document.registryRecords()
        .stream()
        .filter(record -> record.state() != RegistryState.NotFound)
        .max(Comparator.comparingInt(record -> record.state().ordinal()))
        .orElse(null);
  }

  public static ExistingCopyState existingCopyStateOf(Document document) {
    RegistryRecord strongest = strongestRegistryRecord(document);
    if (strongest == null) {
      return ExistingCopyState.None;
    }
    return switch (strongest.state()) {
      case CheckFailed -> ExistingCopyState.CheckFailed;
      case NotFound -> ExistingCopyState.None;
      case Unmapped -> ExistingCopyState.Unmapped;
      case Planned -> ExistingCopyState.Planned;
      case InProgress -> ExistingCopyState.InProgress;
      case Digitized -> ExistingCopyState.Digitized;
      case Published -> ExistingCopyState.Published;
    };
  }

  private static AskDecision askDecisionOf(Decision decision) {
    return switch (decision) {
      case Pending -> AskDecision.Pending;
      case Approved -> AskDecision.Approved;
      case Denied -> AskDecision.Denied;
      case Withdrawn -> AskDecision.Withdrawn;
      case Duplicate -> null;
    };
  }

  public static String documentIdentifierOf(Document document) {
    return document.unitValue() == null ? document.catalogId()
                                        : document.catalogId() + " · " + document.unitValue();
  }
}
