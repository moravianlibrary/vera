package cz.mzk.vera.domain.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Batch;
import cz.mzk.vera.domain.entities.Cancellation;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.ExistingCopy;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.IterationLink;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.PublicationLink;
import cz.mzk.vera.domain.entities.RegistryRecord;
import cz.mzk.vera.domain.entities.RegistryState;
import cz.mzk.vera.domain.entities.Relation;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.entities.Restriction;
import cz.mzk.vera.domain.entities.RestrictionOverride;
import cz.mzk.vera.domain.entities.Verdict;
import cz.mzk.vera.domain.entities.VerdictKind;
import cz.mzk.vera.domain.requests.ProposalDecision;
import cz.mzk.vera.domain.requests.RequestRow;
import cz.mzk.vera.domain.requests.Requests;
import cz.mzk.vera.domain.proposals.Proposals;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

// LC-REQ-join, STAT-validation, FILTER-range, DOC-property-values, DOC-identifiers.
class DomainRulesTests {
  @Test
  void categoryLineageIsRootFirstAndUnknownIsEmpty() {
    List<Category> categories = List.of(
        new Category("root", null), new Category("child", "root"),
        new Category("leaf", "child"));
    assertEquals(List.of("root", "child", "leaf"), Categories.lineageOf(categories, "leaf"));
    assertEquals(List.of("root"), Categories.lineageOf(categories, "root"));
    assertEquals(List.of(), Categories.lineageOf(categories, "missing"));
  }

  @Test
  void listSlicesCountValuesAndBuildConsecutiveHeaders() {
    assertEquals(new Listing.Slice(List.of("b", "c"), "c"),
        Listing.sliceOf(List.of("a", "b", "c", "d"), "a", 2));
    assertEquals(new Listing.Slice(List.of(), null),
        Listing.sliceOf(List.of("a", "b"), "missing", 2));
    assertEquals(List.of(Map.entry("x", 2), Map.entry("y", 1)),
        Listing.countValues(List.of("x", "y", "x")));
    assertEquals(List.of(new Listing.Header("x", 2, 3), new Listing.Header(null, 1, 2)),
        Listing.headersOf(Arrays.asList("x", "x", null), Arrays.asList("x", "x", "x", null, null)));
  }

  private Iteration iteration(Progress progress, Cancellation cancellation) {
    return new Iteration(
        "i", "d", 1, "r", "c", null, progress, null, null, cancellation, List.of(), List.of());
  }

  private Request request(String id, Decision decision, String at, String iterationId, String tracksId,
      List<ExistingCopy> copies, String checkedAt) {
    IterationLink followed = iterationId == null ? null : new IterationLink(Relation.Originates, iterationId);
    return new Request(
        id, "d", "u", at, null, "b", null, decision, followed, tracksId, copies, checkedAt, false);
  }

  @Test
  void progressThresholdAndDecisionStatus() {
    assertTrue(Status.isProgressAtLeast(Progress.Published, Progress.Digitized));
    assertFalse(Status.isProgressAtLeast(Progress.Ready, Progress.Digitized));
    assertEquals(Status.DisplayStatus.AwaitingReview, Status.decisionStatusOf(Decision.Pending));
  }

  @Test
  void verdictsRevokeApprovalsAndDefectsRemainVisible() {
    Iteration item =
        new Iteration("i", "d", 1, "r", "c", null, Progress.Ready, null, null, null,
            List.of(new Defect("k", "instance", "rule", "subject", "2026-01-01T00:00:00Z")),
            List.of(new Verdict(List.of("k"), VerdictKind.Approved),
                new Verdict(List.of("k"), VerdictKind.Revoked)));
    assertTrue(Status.approvedKeysOf(item).isEmpty());
    assertEquals(List.of("k"), Status.outstandingDefects(item).stream().map(Defect::key).toList());
    assertTrue(Status.deniedKeysOf(item).isEmpty());
  }

  @Test
  void restrictionAndPublicIterationBranches() {
    Iteration restricted = new Iteration(
        "i", "d", 1, "r", "c", null, Progress.Ready,
        new Restriction("r", "2026-01-01T00:00:00Z"), null, null, List.of(), List.of());
    assertTrue(Status.isRestricted(restricted));
    assertEquals(Status.PublicStatus.BeingAdded,
        Status.publicIterationStatusOf(iteration(Progress.IngestFailed, null)));
    assertEquals(
        Status.PublicStatus.BeingChecked, Status.publicIterationStatusOf(iteration(Progress.Enqueued, null)));
  }

  @Test
  void documentIterationAndAskRelations() {
    Iteration current = iteration(Progress.Ready, null);
    Request pending = request("p", Decision.Pending, "2026-01-01", null, null, List.of(), null);
    Request followed = request("a", Decision.Approved, "2026-01-02", "i", null, List.of(), "checked");
    Request duplicate = request("x", Decision.Duplicate, "2026-01-03", null, "i", List.of(), "checked");
    DocumentRecord record = record(List.of(current), List.of(pending, followed, duplicate));
    assertEquals(current, Documents.currentIterationOf(record));
    assertEquals(current, Documents.iterationOf(record, "i"));
    assertNull(Documents.iterationOf(record, "missing"));
    assertTrue(Documents.isAttemptOver(iteration(Progress.Published, null)));
    assertFalse(Documents.isAttemptOver(current));
    assertEquals("i", Documents.followedIterationId(followed));
    assertEquals("i", Documents.followedIterationId(duplicate));
    assertNull(Documents.followedIterationId(pending));
    assertEquals(List.of(pending, followed, duplicate), Documents.askersOf(record));
    assertNull(Documents.currentIterationOf(record(List.of(), List.of())));
    assertEquals(List.of(pending), Documents.askersOf(record(List.of(), List.of(pending))));
  }

  @Test
  void requestOrderingAndCopies() {
    ExistingCopy copy = new ExistingCopy("registry", RegistryState.Published, null, null);
    Request older = request("a", Decision.Pending, "2026-01-01", null, null, List.of(copy), null);
    Request newer = request("b", Decision.Pending, "2026-02-01", null, null, List.of(copy), null);
    DocumentRecord record = record(List.of(), List.of(older, newer));
    assertEquals("b", Documents.latestPublicAskOf(record, "u").id());
    assertEquals(List.of("b", "a"), Documents.requestsBy(record, "u").stream().map(Request::id).toList());
    assertEquals(1, Documents.existingCopiesOf(List.of(older, newer)).size());
    assertFalse(Documents.isShownAsBatch(new Batch("b", 1)));
    assertTrue(Documents.isShownAsBatch(new Batch("b", 2)));
  }

  @Test
  void requestRowDerivedCollections() {
    Request first = new Request(
        "a", "d", "u", "1", "reason", "b", "p", Decision.Pending, null, null, List.of(), "checked", true);
    Request second = new Request(
        "b", "d", "v", "2", "other", "c", null, Decision.Pending, null, null, List.of(), "checked", false);
    RequestRow row =
        new RequestRow(record(List.of(), List.of(first, second)), ProposalDecision.Pending, List.of(), null);
    assertEquals(List.of("u", "v"), Requests.askerIdsOf(row));
    assertEquals(first, Requests.firstAskOf(row));
    assertTrue(Requests.isAfterProjectApproval(row));
    assertEquals(List.of("p"), Requests.projectIdsOf(row));
    assertEquals(List.of("b", "c"), Requests.batchIdsOf(row));
    assertEquals(List.of("reason", "other"), Requests.reasonsOf(row));
  }

  @Test
  void valueParsingAndCalendarHelpers() {
    assertEquals(42L, ValueRange.parseCount("42"));
    assertNull(ValueRange.parseCount("4x"));
    assertEquals(LocalDate.of(2026, 6, 1), ValueRange.parseDay("2026-06-01"));
    assertNull(ValueRange.parseDay("2026-02-30"));
    assertTrue(ValueRange.isOpenRange(new Range<>(null, null)));
    assertFalse(ValueRange.isOpenRange(new Range<>("a", null)));
    assertEquals(new Range<>("2026-06-01", "2026-06-07"), ValueRange.weekRange(LocalDate.of(2026, 6, 3)));
  }

  @Test
  void requestDecisionType() {
    assertTrue(Requests.isProposalDecision(Decision.Pending));
    assertFalse(Requests.isProposalDecision(Decision.Duplicate));
  }

  @Test
  void uncoveredDocumentBranches() {
    Iteration cancelled = iteration(Progress.Ready, new Cancellation(CancellationCause.Decided));
    assertTrue(Documents.isAttemptOver(cancelled));

    Request unrelated = request("other", Decision.Pending, "2026-01-02", null, null, List.of(), null);
    DocumentRecord record = record(List.of(), List.of(unrelated));
    assertEquals(unrelated, Documents.latestPublicAskOf(record, "another-user"));

    RequestRow empty =
        new RequestRow(record(List.of(), List.of()), ProposalDecision.Pending, List.of(), null);
    assertNull(Requests.firstAskOf(empty));
    assertTrue(Requests.asksOf(empty).isEmpty());

    Document volume = new Document("d", "catalog-id", "Volume 2", List.of(), List.of());
    assertEquals("catalog-id · Volume 2", Documents.documentIdentifierOf(volume));
  }

  @Test
  void dayRangeTypeHelpers() {
    assertEquals("2026-06-01", ValueRange.dayOf(LocalDate.of(2026, 6, 1)));
    assertTrue(ValueRange.isDayPreset(new DayRange(null, ValueRange.DayPreset.ThisMonth)));
    assertFalse(ValueRange.isDayPreset(new DayRange(new Range<>(LocalDate.of(2026, 6, 1), null), null)));
  }

  @Test
  void proposalBatchNameUsesPragueTimeAndPrimaryLinkIsSelected() {
    assertEquals("2026-06-25 10:40",
        Proposals.defaultBatchNameOf(Instant.parse("2026-06-25T08:40:00Z")));
    Iteration linked = new Iteration("i", "d", 1, "r", "c", null, Progress.Digitized,
        null, null, null, List.of(), List.of(), List.of(
            new PublicationLink("secondary", "https://example.test/2", false),
            new PublicationLink("primary", "https://example.test/1", true)));
    assertEquals(new PublicationLink("primary", "https://example.test/1", true),
        Iterations.primaryLinkOf(linked));
    assertNull(Iterations.primaryLinkOf(iteration(Progress.Ready, null)));
  }

  private DocumentRecord record(List<Iteration> iterations, List<Request> requests) {
    return new DocumentRecord(new Document("d", "catalog", null, List.of(), List.of()), iterations, requests);
  }
}
