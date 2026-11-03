import { render, screen } from "@testing-library/react";
import type { EventEntry } from "@vera/domain/events";
import { describe, expect, it } from "vitest";
import { HistoryCard } from "@/components/record-cards";

const event: EventEntry = {
  id: "e1",
  subjectKind: "request",
  subjectId: "r1",
  at: "2026-01-01T00:00:00Z",
  actor: { kind: "user", userId: "u1" },
  correlationId: "c1",
  reason: { public: "We received it", internal: "staff note" },
  code: "request.created",
  data: { batch: { id: "b1", name: "January batch" }, source: null },
};
describe("HistoryCard", () => {
  it("shows a kept classifier suggestion only in staff History", () => {
    const approved: EventEntry = {
      ...event,
      code: "request.approved",
      data: {
        iterationId: "IT1",
        isRescan: false,
        batchSize: null,
        suggestion: {
          category: { id: "cat1", name: "Books / History" },
          classifier: { id: "cl1", name: "Classifier" },
          kept: true,
        },
      },
    };
    const { rerender } = render(
      <HistoryCard log={[approved]} nameOf={() => "Ada"} isPublic={false} />,
    );
    expect(screen.getByText("Suggested by Classifier: Books / History")).toBeInTheDocument();
    rerender(<HistoryCard log={[approved]} nameOf={() => "Ada"} isPublic />);
    expect(screen.queryByText("Suggested by Classifier: Books / History")).not.toBeInTheDocument();
  });

  it("shows each logged request once and renders its audience wording", () => {
    const { rerender } = render(
      <HistoryCard log={[event]} nameOf={() => "Ada"} isPublic={false} />,
    );
    expect(screen.getAllByText("Asked for")).toHaveLength(1);
    expect(screen.getByText("January batch")).toBeInTheDocument();
    expect(screen.getByText("staff note")).toBeInTheDocument();
    expect(screen.getByText("Told the asker: We received it")).toBeInTheDocument();

    rerender(<HistoryCard log={[event]} nameOf={() => "Ada"} isPublic />);
    expect(screen.getByText("Asked")).toBeInTheDocument();
    expect(screen.queryByText("January batch")).not.toBeInTheDocument();
    expect(screen.queryByText("staff note")).not.toBeInTheDocument();
    expect(screen.queryByText("We received it")).not.toBeInTheDocument();
  });
});
